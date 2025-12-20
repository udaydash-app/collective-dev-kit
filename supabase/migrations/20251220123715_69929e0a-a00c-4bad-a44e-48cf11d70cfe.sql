CREATE OR REPLACE FUNCTION public.handle_pos_journal_entry()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cash_account_id UUID;
  v_mobile_money_account_id UUID;
  v_sales_account_id UUID;
  v_discount_account_id UUID;
  v_tax_account_id UUID;
  v_timbre_account_id UUID;
  v_ar_account_id UUID;
  v_cogs_account_id UUID;
  v_inventory_account_id UUID;
  v_customer_ledger_id UUID;
  v_journal_entry_id UUID;
  v_payment_account_id UUID;
  v_existing_entry_count INTEGER;
  v_total_cogs NUMERIC := 0;
  v_item JSONB;
  v_cogs_result RECORD;
  v_is_refund BOOLEAN := FALSE;
  v_abs_total NUMERIC;
  v_abs_subtotal NUMERIC;
  v_abs_discount NUMERIC;
  v_abs_tax NUMERIC;
  v_abs_timbre_tax NUMERIC := 0;
  v_total_debit NUMERIC;
  v_total_credit NUMERIC;
BEGIN
  -- Handle DELETE
  IF TG_OP = 'DELETE' THEN
    DELETE FROM journal_entries 
    WHERE reference = OLD.transaction_number;
    RETURN OLD;
  END IF;

  -- Handle UPDATE - delete old entries first
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM journal_entries 
    WHERE reference = OLD.transaction_number;
  END IF;

  -- Check if this is a refund transaction
  v_is_refund := (NEW.metadata IS NOT NULL AND (NEW.metadata->>'is_refund')::boolean = true) OR NEW.total < 0;

  -- Use absolute values for calculations
  v_abs_total := ABS(NEW.total);
  v_abs_subtotal := ABS(NEW.subtotal);
  v_abs_discount := ABS(NEW.discount);
  v_abs_tax := ABS(NEW.tax);
  
  -- Extract Timbre tax from metadata - check both snake_case and camelCase keys
  IF NEW.metadata IS NOT NULL THEN
    IF NEW.metadata ? 'timbre_tax' THEN
      v_abs_timbre_tax := ABS(COALESCE((NEW.metadata->>'timbre_tax')::NUMERIC, 0));
    ELSIF NEW.metadata ? 'timbreTax' THEN
      v_abs_timbre_tax := ABS(COALESCE((NEW.metadata->>'timbreTax')::NUMERIC, 0));
    END IF;
  END IF;

  -- Check if journal entry already exists
  SELECT COUNT(*) INTO v_existing_entry_count
  FROM journal_entries
  WHERE reference = NEW.transaction_number;

  IF v_existing_entry_count > 0 THEN
    RETURN NEW;
  END IF;

  -- Get account IDs using SYSCOHADA codes
  SELECT id INTO v_cash_account_id FROM accounts WHERE account_code = '571' AND is_active = true LIMIT 1;
  SELECT id INTO v_mobile_money_account_id FROM accounts WHERE account_code = '521' LIMIT 1;
  SELECT id INTO v_sales_account_id FROM accounts WHERE account_code = '701' LIMIT 1;
  SELECT id INTO v_discount_account_id FROM accounts WHERE account_code = '709' LIMIT 1;
  SELECT id INTO v_tax_account_id FROM accounts WHERE account_code = '4431' LIMIT 1;
  SELECT id INTO v_timbre_account_id FROM accounts WHERE account_code = '4471' LIMIT 1;
  SELECT id INTO v_ar_account_id FROM accounts WHERE account_code = '411' LIMIT 1;
  SELECT id INTO v_cogs_account_id FROM accounts WHERE account_code = '603' LIMIT 1;
  SELECT id INTO v_inventory_account_id FROM accounts WHERE account_code = '31' LIMIT 1;

  -- Get customer ledger account if customer_id is set
  IF NEW.customer_id IS NOT NULL THEN
    SELECT customer_ledger_account_id INTO v_customer_ledger_id 
    FROM contacts 
    WHERE id = NEW.customer_id;
  END IF;

  -- Calculate total for journal entry (excluding timbre from regular tax)
  v_total_debit := v_abs_total;
  v_total_credit := v_abs_total;

  -- Create journal entry
  INSERT INTO journal_entries (
    description,
    entry_date,
    reference,
    total_debit,
    total_credit,
    transaction_amount,
    status,
    posted_at
  ) VALUES (
    CASE WHEN v_is_refund THEN 'Remboursement POS - ' ELSE 'Vente POS - ' END || NEW.transaction_number,
    CURRENT_DATE,
    NEW.transaction_number,
    v_total_debit,
    v_total_credit,
    NEW.total,
    'posted',
    NOW()
  ) RETURNING id INTO v_journal_entry_id;

  -- Determine payment account based on payment method
  CASE NEW.payment_method
    WHEN 'cash' THEN v_payment_account_id := v_cash_account_id;
    WHEN 'mobile_money' THEN v_payment_account_id := v_mobile_money_account_id;
    WHEN 'card' THEN v_payment_account_id := v_cash_account_id;
    WHEN 'credit' THEN v_payment_account_id := COALESCE(v_customer_ledger_id, v_ar_account_id);
    ELSE v_payment_account_id := v_cash_account_id;
  END CASE;

  IF v_is_refund THEN
    -- REFUND: Reverse entries
    -- Credit: Cash/Payment account
    IF v_payment_account_id IS NOT NULL AND v_abs_total > 0 THEN
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
      VALUES (v_journal_entry_id, v_payment_account_id, 'Remboursement client', 0, v_abs_total);
    END IF;

    -- Debit: Sales revenue
    IF v_abs_subtotal > 0 THEN
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
      VALUES (v_journal_entry_id, v_sales_account_id, 'Annulation vente', v_abs_subtotal + v_abs_discount, 0);
    END IF;

    -- Credit: Discount (if any)
    IF v_abs_discount > 0 AND v_discount_account_id IS NOT NULL THEN
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
      VALUES (v_journal_entry_id, v_discount_account_id, 'Annulation remise', 0, v_abs_discount);
    END IF;

    -- Debit: Tax (if any) - excluding timbre
    IF (v_abs_tax - v_abs_timbre_tax) > 0 AND v_tax_account_id IS NOT NULL THEN
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
      VALUES (v_journal_entry_id, v_tax_account_id, 'Annulation TVA', v_abs_tax - v_abs_timbre_tax, 0);
    END IF;

    -- Debit: Timbre tax (if any)
    IF v_abs_timbre_tax > 0 AND v_timbre_account_id IS NOT NULL THEN
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
      VALUES (v_journal_entry_id, v_timbre_account_id, 'Annulation droit de timbre', v_abs_timbre_tax, 0);
    END IF;
  ELSE
    -- SALE: Normal entries
    -- Debit: Cash/Payment account
    IF v_payment_account_id IS NOT NULL AND v_abs_total > 0 THEN
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
      VALUES (v_journal_entry_id, v_payment_account_id, 
        CASE NEW.payment_method 
          WHEN 'credit' THEN 'Vente à crédit'
          WHEN 'mobile_money' THEN 'Paiement Mobile Money'
          ELSE 'Paiement espèces'
        END, v_abs_total, 0);
    END IF;

    -- Credit: Sales revenue (gross amount before discount)
    IF v_abs_subtotal > 0 THEN
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
      VALUES (v_journal_entry_id, v_sales_account_id, 'Ventes de marchandises', 0, v_abs_subtotal + v_abs_discount);
    END IF;

    -- Debit: Discount given (if any)
    IF v_abs_discount > 0 AND v_discount_account_id IS NOT NULL THEN
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
      VALUES (v_journal_entry_id, v_discount_account_id, 'Remise accordée', v_abs_discount, 0);
    END IF;

    -- Credit: Sales tax (VAT - if any) - excluding timbre
    IF (v_abs_tax - v_abs_timbre_tax) > 0 AND v_tax_account_id IS NOT NULL THEN
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
      VALUES (v_journal_entry_id, v_tax_account_id, 'TVA collectée', 0, v_abs_tax - v_abs_timbre_tax);
    END IF;

    -- Credit: Timbre tax separately to account 4471 (if any)
    IF v_abs_timbre_tax > 0 AND v_timbre_account_id IS NOT NULL THEN
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
      VALUES (v_journal_entry_id, v_timbre_account_id, 'Droit de timbre', 0, v_abs_timbre_tax);
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;