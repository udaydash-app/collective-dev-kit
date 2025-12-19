-- Create Timbre Tax Payable account if not exists
INSERT INTO accounts (account_code, account_name, account_type, description, is_active)
SELECT '2025', 'Timbre Tax Payable', 'liability', 'Timbre/Stamp duty tax collected from customers', true
WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE account_code = '2025');

-- Update the handle_pos_journal_entry trigger to record Timbre tax separately
CREATE OR REPLACE FUNCTION handle_pos_journal_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  
  -- Extract Timbre tax from metadata if present
  IF NEW.metadata IS NOT NULL AND NEW.metadata ? 'timbreTax' THEN
    v_abs_timbre_tax := ABS(COALESCE((NEW.metadata->>'timbreTax')::NUMERIC, 0));
  END IF;

  -- Check if journal entry already exists
  SELECT COUNT(*) INTO v_existing_entry_count
  FROM journal_entries
  WHERE reference = NEW.transaction_number;

  IF v_existing_entry_count > 0 THEN
    RETURN NEW;
  END IF;

  -- Get account IDs
  SELECT id INTO v_cash_account_id FROM accounts WHERE account_code = '1010' LIMIT 1;
  SELECT id INTO v_mobile_money_account_id FROM accounts WHERE account_code = '1015' LIMIT 1;
  SELECT id INTO v_sales_account_id FROM accounts WHERE account_code = '4010' LIMIT 1;
  SELECT id INTO v_discount_account_id FROM accounts WHERE account_code = '4020' LIMIT 1;
  SELECT id INTO v_tax_account_id FROM accounts WHERE account_code = '2020' LIMIT 1;
  SELECT id INTO v_timbre_account_id FROM accounts WHERE account_code = '2025' LIMIT 1;
  SELECT id INTO v_ar_account_id FROM accounts WHERE account_code = '1030' LIMIT 1;
  SELECT id INTO v_cogs_account_id FROM accounts WHERE account_code = '5010' LIMIT 1;
  SELECT id INTO v_inventory_account_id FROM accounts WHERE account_code = '1020' LIMIT 1;

  -- Get customer ledger account if customer is linked
  IF NEW.customer_id IS NOT NULL THEN
    SELECT customer_ledger_account_id INTO v_customer_ledger_id
    FROM contacts
    WHERE id = NEW.customer_id;
  END IF;

  -- Skip COGS calculation for refunds
  IF NOT v_is_refund THEN
    IF NEW.metadata IS NOT NULL AND NEW.metadata ? 'total_cogs' THEN
      v_total_cogs := (NEW.metadata->>'total_cogs')::NUMERIC;
    ELSE
      FOR v_item IN SELECT * FROM jsonb_array_elements(NEW.items)
      LOOP
        BEGIN
          FOR v_cogs_result IN 
            SELECT * FROM deduct_stock_fifo(
              (v_item->>'productId')::UUID,
              (v_item->>'variantId')::UUID,
              ABS((v_item->>'quantity')::NUMERIC)
            )
          LOOP
            v_total_cogs := v_total_cogs + v_cogs_result.total_cogs;
          END LOOP;
        EXCEPTION
          WHEN OTHERS THEN
            v_total_cogs := v_total_cogs + ((v_item->>'price')::NUMERIC * ABS((v_item->>'quantity')::NUMERIC) * 0.7);
        END;
      END LOOP;
    END IF;
  END IF;

  -- Calculate balanced debits and credits (include Timbre tax in totals)
  IF v_is_refund THEN
    v_total_debit := v_abs_subtotal + v_abs_tax + v_abs_timbre_tax;
    v_total_credit := v_abs_subtotal + v_abs_tax + v_abs_timbre_tax;
  ELSE
    v_total_debit := v_abs_total + v_abs_discount + v_total_cogs;
    v_total_credit := v_abs_subtotal + v_abs_tax + v_abs_timbre_tax + v_total_cogs;
  END IF;

  -- Create journal entry
  INSERT INTO journal_entries (
    description,
    entry_date,
    reference,
    total_debit,
    total_credit,
    transaction_amount,
    status,
    created_by,
    posted_by,
    posted_at
  ) VALUES (
    CASE WHEN v_is_refund THEN 'POS Refund - ' ELSE 'POS Sale - ' END || NEW.transaction_number,
    CURRENT_DATE,
    NEW.transaction_number,
    v_total_debit,
    v_total_credit,
    v_abs_total,
    'posted',
    NEW.cashier_id,
    NEW.cashier_id,
    NOW()
  ) RETURNING id INTO v_journal_entry_id;

  -- Determine payment account based on payment method
  CASE NEW.payment_method
    WHEN 'cash' THEN v_payment_account_id := v_cash_account_id;
    WHEN 'mobile_money' THEN v_payment_account_id := v_mobile_money_account_id;
    WHEN 'card' THEN v_payment_account_id := v_cash_account_id;
    WHEN 'credit' THEN v_payment_account_id := v_customer_ledger_id;
    WHEN 'exchange' THEN v_payment_account_id := NULL;
    ELSE v_payment_account_id := v_cash_account_id;
  END CASE;

  -- Create journal entry lines based on refund or sale
  IF v_is_refund THEN
    -- Refund: Reverse the original sale
    -- Debit: Sales Revenue (decrease)
    IF v_abs_subtotal > 0 THEN
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
      VALUES (v_journal_entry_id, v_sales_account_id, 'Refund revenue', v_abs_subtotal, 0);
    END IF;

    -- Debit: Sales Tax Payable (decrease liability)
    IF v_abs_tax > 0 THEN
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
      VALUES (v_journal_entry_id, v_tax_account_id, 'Refund tax', v_abs_tax, 0);
    END IF;

    -- Debit: Timbre Tax Payable (decrease liability) - if applicable
    IF v_abs_timbre_tax > 0 AND v_timbre_account_id IS NOT NULL THEN
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
      VALUES (v_journal_entry_id, v_timbre_account_id, 'Refund Timbre tax', v_abs_timbre_tax, 0);
    END IF;

    -- Credit: Payment Account or AR (return cash/reduce receivable)
    IF NEW.payment_method = 'credit' AND v_customer_ledger_id IS NOT NULL THEN
      IF v_abs_total > 0 THEN
        INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
        VALUES (v_journal_entry_id, v_customer_ledger_id, 'Refund to customer account', 0, v_abs_total);
      END IF;
    ELSIF v_payment_account_id IS NOT NULL AND v_abs_total > 0 THEN
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
      VALUES (v_journal_entry_id, v_payment_account_id, 'Refund payment', 0, v_abs_total);
    END IF;

  ELSE
    -- Regular sale
    -- Debit: Cash/Mobile Money/AR (what we receive)
    IF NEW.payment_method = 'credit' AND v_customer_ledger_id IS NOT NULL THEN
      IF v_abs_total > 0 THEN
        INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
        VALUES (v_journal_entry_id, v_customer_ledger_id, 'Sale on credit', v_abs_total, 0);
      END IF;
    ELSIF v_payment_account_id IS NOT NULL AND v_abs_total > 0 THEN
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
      VALUES (v_journal_entry_id, v_payment_account_id, 'Cash/payment received', v_abs_total, 0);
    END IF;

    -- Debit: Sales Discount (if any)
    IF v_abs_discount > 0 THEN
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
      VALUES (v_journal_entry_id, v_discount_account_id, 'Sales discount', v_abs_discount, 0);
    END IF;

    -- Credit: Sales Revenue
    IF v_abs_subtotal > 0 THEN
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
      VALUES (v_journal_entry_id, v_sales_account_id, 'Sales revenue', 0, v_abs_subtotal);
    END IF;

    -- Credit: Sales Tax Payable (regular tax like 15% VAT)
    IF v_abs_tax > 0 THEN
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
      VALUES (v_journal_entry_id, v_tax_account_id, 'Sales tax', 0, v_abs_tax);
    END IF;

    -- Credit: Timbre Tax Payable (stamp duty) - separate account
    IF v_abs_timbre_tax > 0 AND v_timbre_account_id IS NOT NULL THEN
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
      VALUES (v_journal_entry_id, v_timbre_account_id, 'Timbre tax', 0, v_abs_timbre_tax);
    END IF;

    -- COGS entries (only for regular sales, not refunds)
    IF v_total_cogs > 0 THEN
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
      VALUES (v_journal_entry_id, v_cogs_account_id, 'Cost of goods sold', v_total_cogs, 0);

      INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
      VALUES (v_journal_entry_id, v_inventory_account_id, 'Inventory reduction', 0, v_total_cogs);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;