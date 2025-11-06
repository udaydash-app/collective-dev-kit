-- Fix payment receipt trigger to use correct column names
CREATE OR REPLACE FUNCTION create_payment_receipt_journal_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_je_id uuid;
  v_customer_account_id uuid;
  v_payment_account_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- Delete the journal entry when payment receipt is deleted
    DELETE FROM journal_entries 
    WHERE reference = OLD.receipt_number;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Update existing journal entry
    UPDATE journal_entries
    SET
      entry_date = NEW.payment_date,
      description = 'Payment Receipt - ' || NEW.receipt_number,
      total_debit = NEW.amount,
      total_credit = NEW.amount,
      updated_at = now()
    WHERE reference = OLD.receipt_number
    RETURNING id INTO v_je_id;

    -- If journal entry found, update the lines
    IF v_je_id IS NOT NULL THEN
      -- Get account IDs
      SELECT customer_ledger_account_id INTO v_customer_account_id
      FROM contacts WHERE id = NEW.contact_id;

      -- Get payment method account
      SELECT id INTO v_payment_account_id
      FROM accounts
      WHERE account_name = CASE NEW.payment_method
        WHEN 'cash' THEN 'Cash'
        WHEN 'card' THEN 'Bank Account'
        WHEN 'mobile_money' THEN 'Mobile Money'
        ELSE 'Cash'
      END
      LIMIT 1;

      -- Delete old lines and create new ones
      DELETE FROM journal_entry_lines WHERE journal_entry_id = v_je_id;

      -- Debit payment account (increases cash/bank)
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description)
      VALUES (v_je_id, v_payment_account_id, NEW.amount, 0, 'Payment method: ' || NEW.payment_method);

      -- Credit customer account (reduces receivable)
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description)
      VALUES (v_je_id, v_customer_account_id, 0, NEW.amount, 'Payment from customer');
    END IF;

    RETURN NEW;
  END IF;

  -- INSERT operation
  SELECT customer_ledger_account_id INTO v_customer_account_id
  FROM contacts WHERE id = NEW.contact_id;

  IF v_customer_account_id IS NULL THEN
    RAISE EXCEPTION 'Customer ledger account not found for contact %', NEW.contact_id;
  END IF;

  SELECT id INTO v_payment_account_id
  FROM accounts
  WHERE account_name = CASE NEW.payment_method
    WHEN 'cash' THEN 'Cash'
    WHEN 'card' THEN 'Bank Account'
    WHEN 'mobile_money' THEN 'Mobile Money'
    ELSE 'Cash'
  END
  LIMIT 1;

  INSERT INTO journal_entries (entry_date, description, reference, total_debit, total_credit, status, posted_at, posted_by, created_by)
  VALUES (
    NEW.payment_date,
    'Payment Receipt - ' || NEW.receipt_number,
    NEW.receipt_number,
    NEW.amount,
    NEW.amount,
    'posted',
    now(),
    NEW.received_by,
    NEW.received_by
  )
  RETURNING id INTO v_je_id;

  INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description)
  VALUES (v_je_id, v_payment_account_id, NEW.amount, 0, 'Payment method: ' || NEW.payment_method);

  INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description)
  VALUES (v_je_id, v_customer_account_id, 0, NEW.amount, 'Payment from customer');

  RETURN NEW;
END;
$function$;

-- Fix supplier payment trigger to use correct column names
CREATE OR REPLACE FUNCTION create_supplier_payment_journal_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_je_id uuid;
  v_supplier_account_id uuid;
  v_payment_account_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- Delete the journal entry when supplier payment is deleted
    DELETE FROM journal_entries 
    WHERE reference = OLD.payment_number;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Update existing journal entry
    UPDATE journal_entries
    SET
      entry_date = NEW.payment_date,
      description = 'Supplier Payment - ' || NEW.payment_number,
      total_debit = NEW.amount,
      total_credit = NEW.amount,
      updated_at = now()
    WHERE reference = OLD.payment_number
    RETURNING id INTO v_je_id;

    -- If journal entry found, update the lines
    IF v_je_id IS NOT NULL THEN
      -- Get account IDs
      SELECT supplier_ledger_account_id INTO v_supplier_account_id
      FROM contacts WHERE id = NEW.contact_id;

      -- Get payment method account
      SELECT id INTO v_payment_account_id
      FROM accounts
      WHERE account_name = CASE NEW.payment_method
        WHEN 'cash' THEN 'Cash'
        WHEN 'card' THEN 'Bank Account'
        WHEN 'mobile_money' THEN 'Mobile Money'
        ELSE 'Cash'
      END
      LIMIT 1;

      -- Delete old lines and create new ones
      DELETE FROM journal_entry_lines WHERE journal_entry_id = v_je_id;

      -- Debit supplier account (reduces liability)
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description)
      VALUES (v_je_id, v_supplier_account_id, NEW.amount, 0, 'Payment to supplier');

      -- Credit payment account
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description)
      VALUES (v_je_id, v_payment_account_id, 0, NEW.amount, 'Payment method: ' || NEW.payment_method);
    END IF;

    RETURN NEW;
  END IF;

  -- INSERT operation
  SELECT supplier_ledger_account_id INTO v_supplier_account_id
  FROM contacts WHERE id = NEW.contact_id;

  IF v_supplier_account_id IS NULL THEN
    RAISE EXCEPTION 'Supplier ledger account not found for contact %', NEW.contact_id;
  END IF;

  SELECT id INTO v_payment_account_id
  FROM accounts
  WHERE account_name = CASE NEW.payment_method
    WHEN 'cash' THEN 'Cash'
    WHEN 'card' THEN 'Bank Account'
    WHEN 'mobile_money' THEN 'Mobile Money'
    ELSE 'Cash'
  END
  LIMIT 1;

  INSERT INTO journal_entries (entry_date, description, reference, total_debit, total_credit, status, posted_at, posted_by, created_by)
  VALUES (
    NEW.payment_date,
    'Supplier Payment - ' || NEW.payment_number,
    NEW.payment_number,
    NEW.amount,
    NEW.amount,
    'posted',
    now(),
    NEW.paid_by,
    NEW.paid_by
  )
  RETURNING id INTO v_je_id;

  INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description)
  VALUES (v_je_id, v_supplier_account_id, NEW.amount, 0, 'Payment to supplier');

  INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description)
  VALUES (v_je_id, v_payment_account_id, 0, NEW.amount, 'Payment method: ' || NEW.payment_method);

  RETURN NEW;
END;
$function$;