
-- Fix handle_pos_journal_entry to properly handle refunds (negative amounts)
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
  v_ar_account_id UUID;
  v_customer_ledger_id UUID;
  v_journal_entry_id UUID;
  v_payment_account_id UUID;
  v_payment RECORD;
  v_payment_details JSONB;
  v_total_amount NUMERIC;
  v_sales_amount NUMERIC;
  v_discount_amount NUMERIC;
  v_tax_amount NUMERIC;
  v_is_refund BOOLEAN;
  v_abs_total NUMERIC;
BEGIN
  -- Handle DELETE - remove the associated journal entry
  IF TG_OP = 'DELETE' THEN
    DELETE FROM journal_entries 
    WHERE reference = OLD.transaction_number;
    RETURN OLD;
  END IF;

  -- Handle UPDATE - delete old journal entry first
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM journal_entries 
    WHERE reference = OLD.transaction_number;
  END IF;

  -- Get account IDs using SYSCOHADA codes
  SELECT id INTO v_cash_account_id FROM accounts WHERE account_code = '571' AND is_active = true LIMIT 1;
  SELECT id INTO v_mobile_money_account_id FROM accounts WHERE account_code = '521' AND is_active = true LIMIT 1;
  SELECT id INTO v_sales_account_id FROM accounts WHERE account_code = '701' AND is_active = true LIMIT 1;
  SELECT id INTO v_discount_account_id FROM accounts WHERE account_code = '709' AND is_active = true LIMIT 1;
  SELECT id INTO v_tax_account_id FROM accounts WHERE account_code = '4471' AND is_active = true LIMIT 1;
  SELECT id INTO v_ar_account_id FROM accounts WHERE account_code = '411' AND is_active = true LIMIT 1;

  -- Get customer ledger account if customer is linked
  IF NEW.customer_id IS NOT NULL THEN
    SELECT customer_ledger_account_id INTO v_customer_ledger_id
    FROM contacts
    WHERE id = NEW.customer_id;
  END IF;

  -- Calculate amounts and determine if this is a refund
  v_total_amount := COALESCE(NEW.total, 0);
  v_is_refund := v_total_amount < 0;
  v_abs_total := ABS(v_total_amount);
  v_discount_amount := ABS(COALESCE(NEW.discount, 0));
  v_tax_amount := ABS(COALESCE(NEW.tax, 0));
  v_sales_amount := ABS(COALESCE(NEW.subtotal, 0)) + v_discount_amount;

  -- Create journal entry with balanced totals (always positive)
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
    CASE WHEN v_is_refund THEN 'Remboursement POS - ' ELSE 'Vente POS - ' END || NEW.transaction_number,
    CURRENT_DATE,
    NEW.transaction_number,
    v_abs_total + v_discount_amount,
    v_abs_total + v_discount_amount,
    v_total_amount,
    'posted',
    NEW.cashier_id,
    NEW.cashier_id,
    NOW()
  ) RETURNING id INTO v_journal_entry_id;

  -- Parse payment_details
  v_payment_details := COALESCE(NEW.payment_details::JSONB, '[]'::JSONB);

  -- Process each payment method from payment_details
  IF jsonb_array_length(v_payment_details) > 0 THEN
    FOR v_payment IN SELECT * FROM jsonb_array_elements(v_payment_details)
    LOOP
      DECLARE
        v_method TEXT := COALESCE(v_payment.value->>'method', 'cash');
        v_amount NUMERIC := ABS(COALESCE((v_payment.value->>'amount')::NUMERIC, 0));
      BEGIN
        IF v_amount > 0 THEN
          -- Determine payment account based on method
          IF v_method = 'mobile_money' THEN
            v_payment_account_id := v_mobile_money_account_id;
          ELSIF v_method = 'credit' THEN
            v_payment_account_id := COALESCE(v_customer_ledger_id, v_ar_account_id);
          ELSE
            v_payment_account_id := v_cash_account_id;
          END IF;

          IF v_payment_account_id IS NOT NULL THEN
            IF v_is_refund THEN
              -- REFUND: Credit payment account (reduce customer receivable or cash)
              INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
              VALUES (v_journal_entry_id, v_payment_account_id, 
                CASE v_method 
                  WHEN 'cash' THEN 'Remboursement espèces'
                  WHEN 'mobile_money' THEN 'Remboursement Mobile Money'
                  WHEN 'credit' THEN 'Réduction crédit client'
                  ELSE 'Remboursement - ' || v_method
                END,
                0, v_amount);
            ELSE
              -- SALE: Debit payment account (increase customer receivable or cash)
              INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
              VALUES (v_journal_entry_id, v_payment_account_id, 
                CASE v_method 
                  WHEN 'cash' THEN 'Paiement espèces'
                  WHEN 'mobile_money' THEN 'Paiement Mobile Money'
                  WHEN 'credit' THEN 'Vente à crédit'
                  ELSE 'Paiement - ' || v_method
                END,
                v_amount, 0);
            END IF;
          END IF;
        END IF;
      END;
    END LOOP;
  ELSE
    -- Fallback: use payment_method field if payment_details is empty
    IF NEW.payment_method = 'mobile_money' THEN
      v_payment_account_id := v_mobile_money_account_id;
    ELSIF NEW.payment_method = 'credit' THEN
      v_payment_account_id := COALESCE(v_customer_ledger_id, v_ar_account_id);
    ELSE
      v_payment_account_id := v_cash_account_id;
    END IF;

    IF v_payment_account_id IS NOT NULL AND v_abs_total > 0 THEN
      IF v_is_refund THEN
        INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
        VALUES (v_journal_entry_id, v_payment_account_id, 
          CASE NEW.payment_method 
            WHEN 'cash' THEN 'Remboursement espèces'
            WHEN 'mobile_money' THEN 'Remboursement Mobile Money'
            WHEN 'credit' THEN 'Réduction crédit client'
            ELSE 'Remboursement'
          END,
          0, v_abs_total);
      ELSE
        INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
        VALUES (v_journal_entry_id, v_payment_account_id, 
          CASE NEW.payment_method 
            WHEN 'cash' THEN 'Paiement espèces'
            WHEN 'mobile_money' THEN 'Paiement Mobile Money'
            WHEN 'credit' THEN 'Vente à crédit'
            ELSE 'Paiement reçu'
          END,
          v_abs_total, 0);
      END IF;
    END IF;
  END IF;

  -- CREDIT/DEBIT: Sales revenue (always handle sales side)
  IF v_sales_amount > 0 THEN
    IF v_is_refund THEN
      -- REFUND: Debit sales (reduce revenue)
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
      VALUES (v_journal_entry_id, v_sales_account_id, 'Retour marchandises', v_sales_amount, 0);
    ELSE
      -- SALE: Credit sales (increase revenue)
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
      VALUES (v_journal_entry_id, v_sales_account_id, 'Ventes de marchandises', 0, v_sales_amount);
    END IF;
  END IF;

  -- Handle discount (only for sales, not refunds)
  IF v_discount_amount > 0 AND NOT v_is_refund THEN
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
    VALUES (v_journal_entry_id, v_discount_account_id, 'Remise accordée', v_discount_amount, 0);
  END IF;

  -- Handle tax
  IF v_tax_amount > 0 THEN
    IF v_is_refund THEN
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
      VALUES (v_journal_entry_id, v_tax_account_id, 'Taxe remboursée', v_tax_amount, 0);
    ELSE
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
      VALUES (v_journal_entry_id, v_tax_account_id, 'Taxe collectée', 0, v_tax_amount);
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Now fix the existing broken journal entry for the refund
-- Delete the empty one and let a re-insert recreate it properly
DELETE FROM journal_entries WHERE reference = 'REF-1766836772986';

-- Manually create the correct journal entry for the existing refund
DO $$
DECLARE
  v_je_id UUID;
  v_customer_ledger_id UUID;
  v_sales_account_id UUID;
BEGIN
  -- Get customer ledger account for ASIAN MART
  SELECT customer_ledger_account_id INTO v_customer_ledger_id 
  FROM contacts WHERE id = 'be3cf463-b14a-487b-815e-a63ac118d5b0';
  
  -- Get sales account
  SELECT id INTO v_sales_account_id FROM accounts WHERE account_code = '701' LIMIT 1;
  
  -- Create journal entry
  INSERT INTO journal_entries (
    description, entry_date, reference, total_debit, total_credit, 
    transaction_amount, status, posted_at
  ) VALUES (
    'Remboursement POS - REF-1766836772986',
    '2025-12-27',
    'REF-1766836772986',
    16800, 16800, -16800,
    'posted', NOW()
  ) RETURNING id INTO v_je_id;
  
  -- Credit customer ledger (reduce receivable)
  INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
  VALUES (v_je_id, v_customer_ledger_id, 'Réduction crédit client', 0, 16800);
  
  -- Debit sales (reduce revenue)
  INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
  VALUES (v_je_id, v_sales_account_id, 'Retour marchandises', 16800, 0);
END $$;
