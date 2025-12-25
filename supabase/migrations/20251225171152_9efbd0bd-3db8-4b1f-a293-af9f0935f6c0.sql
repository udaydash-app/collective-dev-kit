-- Update POS journal entry function to handle multiple payment methods from payment_details
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
  v_has_credit_payment BOOLEAN := FALSE;
  v_credit_amount NUMERIC := 0;
  v_non_credit_amount NUMERIC := 0;
  v_total_debit NUMERIC := 0;
  v_total_credit NUMERIC := 0;
BEGIN
  -- Handle DELETE - remove the associated journal entry
  IF TG_OP = 'DELETE' THEN
    DELETE FROM journal_entries 
    WHERE reference = OLD.transaction_number 
      AND description = 'POS Sale - ' || OLD.transaction_number;
    RETURN OLD;
  END IF;

  -- Handle UPDATE - delete old journal entry first
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM journal_entries 
    WHERE reference = OLD.transaction_number 
      AND description = 'POS Sale - ' || OLD.transaction_number;
  END IF;

  -- Get account IDs using SYSCOHADA codes
  SELECT id INTO v_cash_account_id FROM accounts WHERE account_code = '571' LIMIT 1;
  SELECT id INTO v_mobile_money_account_id FROM accounts WHERE account_code = '521' LIMIT 1;
  SELECT id INTO v_sales_account_id FROM accounts WHERE account_code = '701' LIMIT 1;
  SELECT id INTO v_discount_account_id FROM accounts WHERE account_code = '709' LIMIT 1;
  SELECT id INTO v_tax_account_id FROM accounts WHERE account_code = '443' LIMIT 1;
  SELECT id INTO v_ar_account_id FROM accounts WHERE account_code = '411' LIMIT 1;

  -- Get customer ledger account if customer is linked
  IF NEW.customer_id IS NOT NULL THEN
    SELECT customer_ledger_account_id INTO v_customer_ledger_id
    FROM contacts
    WHERE id = NEW.customer_id;
  END IF;

  -- Parse payment_details to check for credit payments
  v_payment_details := COALESCE(NEW.payment_details::JSONB, '[]'::JSONB);
  
  -- Calculate credit and non-credit amounts
  FOR v_payment IN SELECT * FROM jsonb_array_elements(v_payment_details)
  LOOP
    IF (v_payment.value->>'method') = 'credit' THEN
      v_has_credit_payment := TRUE;
      v_credit_amount := v_credit_amount + COALESCE((v_payment.value->>'amount')::NUMERIC, 0);
    ELSE
      v_non_credit_amount := v_non_credit_amount + COALESCE((v_payment.value->>'amount')::NUMERIC, 0);
    END IF;
  END LOOP;

  -- Calculate total debit and credit for balanced entry
  -- This depends on whether there's a customer and payment type
  v_total_debit := NEW.total;
  v_total_credit := NEW.subtotal + NEW.tax;
  
  IF v_customer_ledger_id IS NOT NULL AND v_non_credit_amount > 0 THEN
    v_total_debit := NEW.total + v_non_credit_amount;
    v_total_credit := NEW.subtotal + NEW.tax + v_non_credit_amount;
  END IF;

  -- Create journal entry
  INSERT INTO journal_entries (
    description,
    entry_date,
    reference,
    total_debit,
    total_credit,
    status,
    created_by,
    posted_by,
    posted_at
  ) VALUES (
    'POS Sale - ' || NEW.transaction_number,
    CURRENT_DATE,
    NEW.transaction_number,
    v_total_debit,
    v_total_credit,
    'posted',
    NEW.cashier_id,
    NEW.cashier_id,
    NOW()
  ) RETURNING id INTO v_journal_entry_id;

  -- MAIN LOGIC: If customer is linked, post sale to customer account
  IF v_customer_ledger_id IS NOT NULL THEN
    -- Step 1: Record the sale (Debit Customer AR)
    INSERT INTO journal_entry_lines (
      journal_entry_id,
      account_id,
      description,
      debit_amount,
      credit_amount
    ) VALUES (
      v_journal_entry_id,
      v_customer_ledger_id,
      'Sale to customer',
      NEW.total,
      0
    );

    -- Credit Sales Revenue
    INSERT INTO journal_entry_lines (
      journal_entry_id,
      account_id,
      description,
      debit_amount,
      credit_amount
    ) VALUES (
      v_journal_entry_id,
      v_sales_account_id,
      'Sales Revenue',
      0,
      NEW.subtotal
    );

    -- Step 2: Process each payment from payment_details
    FOR v_payment IN SELECT * FROM jsonb_array_elements(v_payment_details)
    LOOP
      DECLARE
        v_method TEXT := v_payment.value->>'method';
        v_amount NUMERIC := COALESCE((v_payment.value->>'amount')::NUMERIC, 0);
      BEGIN
        IF v_method != 'credit' AND v_amount > 0 THEN
          -- Determine payment account
          IF v_method = 'mobile_money' THEN
            v_payment_account_id := v_mobile_money_account_id;
          ELSIF v_method = 'cash' THEN
            v_payment_account_id := v_cash_account_id;
          ELSE
            v_payment_account_id := v_cash_account_id; -- Default to cash
          END IF;

          -- Debit Cash/Mobile Money
          INSERT INTO journal_entry_lines (
            journal_entry_id,
            account_id,
            description,
            debit_amount,
            credit_amount
          ) VALUES (
            v_journal_entry_id,
            v_payment_account_id,
            'Payment received - ' || v_method,
            v_amount,
            0
          );

          -- Credit Customer AR (payment)
          INSERT INTO journal_entry_lines (
            journal_entry_id,
            account_id,
            description,
            debit_amount,
            credit_amount
          ) VALUES (
            v_journal_entry_id,
            v_customer_ledger_id,
            'Payment received - ' || v_method,
            0,
            v_amount
          );
        END IF;
      END;
    END LOOP;
  ELSE
    -- No customer linked - process each payment from payment_details
    FOR v_payment IN SELECT * FROM jsonb_array_elements(v_payment_details)
    LOOP
      DECLARE
        v_method TEXT := v_payment.value->>'method';
        v_amount NUMERIC := COALESCE((v_payment.value->>'amount')::NUMERIC, 0);
      BEGIN
        IF v_amount > 0 THEN
          -- Determine payment account
          IF v_method = 'mobile_money' THEN
            v_payment_account_id := v_mobile_money_account_id;
          ELSIF v_method = 'cash' THEN
            v_payment_account_id := v_cash_account_id;
          ELSIF v_method = 'credit' THEN
            v_payment_account_id := v_ar_account_id;
          ELSE
            v_payment_account_id := v_cash_account_id;
          END IF;

          INSERT INTO journal_entry_lines (
            journal_entry_id,
            account_id,
            description,
            debit_amount,
            credit_amount
          ) VALUES (
            v_journal_entry_id,
            v_payment_account_id,
            'POS Sale - ' || v_method,
            v_amount,
            0
          );
        END IF;
      END;
    END LOOP;

    -- Credit Sales Revenue
    INSERT INTO journal_entry_lines (
      journal_entry_id,
      account_id,
      description,
      debit_amount,
      credit_amount
    ) VALUES (
      v_journal_entry_id,
      v_sales_account_id,
      'Sales Revenue',
      0,
      NEW.subtotal
    );
  END IF;

  -- Sales Tax
  IF NEW.tax > 0 THEN
    INSERT INTO journal_entry_lines (
      journal_entry_id,
      account_id,
      description,
      debit_amount,
      credit_amount
    ) VALUES (
      v_journal_entry_id,
      v_tax_account_id,
      'Sales Tax Collected',
      0,
      NEW.tax
    );
  END IF;

  -- Sales Discount
  IF NEW.discount > 0 AND v_discount_account_id IS NOT NULL THEN
    INSERT INTO journal_entry_lines (
      journal_entry_id,
      account_id,
      description,
      debit_amount,
      credit_amount
    ) VALUES (
      v_journal_entry_id,
      v_discount_account_id,
      'Sales Discount',
      NEW.discount,
      0
    );
  END IF;

  RETURN NEW;
END;
$function$;