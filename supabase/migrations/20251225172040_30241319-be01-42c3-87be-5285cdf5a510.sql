-- Fix POS journal entry function to properly handle multiple payment methods
CREATE OR REPLACE FUNCTION handle_pos_journal_entry()
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

  -- Calculate amounts
  v_total_amount := COALESCE(NEW.total, 0);
  v_discount_amount := COALESCE(NEW.discount, 0);
  v_tax_amount := COALESCE(NEW.tax, 0);
  v_sales_amount := COALESCE(NEW.subtotal, 0) + v_discount_amount; -- Gross sales before discount

  -- Create journal entry with balanced totals
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
    'Vente POS - ' || NEW.transaction_number,
    CURRENT_DATE,
    NEW.transaction_number,
    v_total_amount + v_discount_amount,
    v_total_amount + v_discount_amount,
    v_total_amount,
    'posted',
    NEW.cashier_id,
    NEW.cashier_id,
    NOW()
  ) RETURNING id INTO v_journal_entry_id;

  -- Parse payment_details
  v_payment_details := COALESCE(NEW.payment_details::JSONB, '[]'::JSONB);

  -- DEBIT: Process each payment method from payment_details
  IF jsonb_array_length(v_payment_details) > 0 THEN
    FOR v_payment IN SELECT * FROM jsonb_array_elements(v_payment_details)
    LOOP
      DECLARE
        v_method TEXT := COALESCE(v_payment.value->>'method', 'cash');
        v_amount NUMERIC := COALESCE((v_payment.value->>'amount')::NUMERIC, 0);
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

          -- Debit the payment account
          IF v_payment_account_id IS NOT NULL THEN
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

    IF v_payment_account_id IS NOT NULL AND v_total_amount > 0 THEN
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
      VALUES (v_journal_entry_id, v_payment_account_id, 'Paiement espèces', v_total_amount, 0);
    END IF;
  END IF;

  -- DEBIT: Discount if any
  IF v_discount_amount > 0 AND v_discount_account_id IS NOT NULL THEN
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
    VALUES (v_journal_entry_id, v_discount_account_id, 'Remise accordée', v_discount_amount, 0);
  END IF;

  -- CREDIT: Sales revenue
  IF v_sales_amount > 0 AND v_sales_account_id IS NOT NULL THEN
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
    VALUES (v_journal_entry_id, v_sales_account_id, 'Ventes de marchandises', 0, v_sales_amount);
  END IF;

  -- CREDIT: Tax (Timbre) if any
  IF v_tax_amount > 0 AND v_tax_account_id IS NOT NULL THEN
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
    VALUES (v_journal_entry_id, v_tax_account_id, 'Droit de timbre', 0, v_tax_amount);
  END IF;

  RETURN NEW;
END;
$function$;