-- Update supplier payment trigger to handle DELETE operations
CREATE OR REPLACE FUNCTION public.create_supplier_payment_journal_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cash_account_id UUID;
  v_mobile_money_account_id UUID;
  v_bank_account_id UUID;
  v_supplier_account_id UUID;
  v_journal_entry_id UUID;
  v_payment_account_id UUID;
BEGIN
  -- Handle DELETE - remove the associated journal entry
  IF TG_OP = 'DELETE' THEN
    DELETE FROM journal_entries 
    WHERE reference = OLD.payment_number 
      AND description = 'Supplier Payment - ' || OLD.payment_number;
    RETURN OLD;
  END IF;

  -- Handle UPDATE - delete old journal entry first
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM journal_entries 
    WHERE reference = OLD.payment_number 
      AND description = 'Supplier Payment - ' || OLD.payment_number;
  END IF;

  -- Get account IDs
  SELECT id INTO v_cash_account_id FROM accounts WHERE account_code = '1010' LIMIT 1;
  SELECT id INTO v_mobile_money_account_id FROM accounts WHERE account_code = '1015' LIMIT 1;
  SELECT id INTO v_bank_account_id FROM accounts WHERE account_code = '1011' LIMIT 1;
  
  -- Get supplier ledger account
  SELECT supplier_ledger_account_id INTO v_supplier_account_id 
  FROM contacts 
  WHERE id = NEW.contact_id;

  -- If no supplier ledger account exists, use general accounts payable
  IF v_supplier_account_id IS NULL THEN
    SELECT id INTO v_supplier_account_id FROM accounts WHERE account_code = '2010' LIMIT 1;
  END IF;

  -- Determine payment account based on method
  CASE NEW.payment_method
    WHEN 'cash' THEN v_payment_account_id := v_cash_account_id;
    WHEN 'mobile_money' THEN v_payment_account_id := v_mobile_money_account_id;
    WHEN 'bank_transfer' THEN v_payment_account_id := v_bank_account_id;
    WHEN 'cheque' THEN v_payment_account_id := v_bank_account_id;
  END CASE;

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
    'Supplier Payment - ' || NEW.payment_number,
    NEW.payment_date,
    NEW.payment_number,
    NEW.amount,
    NEW.amount,
    'posted',
    NEW.paid_by,
    NEW.paid_by,
    NOW()
  ) RETURNING id INTO v_journal_entry_id;

  -- Debit Accounts Payable / Supplier Account (reduces liability)
  INSERT INTO journal_entry_lines (
    journal_entry_id,
    account_id,
    description,
    debit_amount,
    credit_amount
  ) VALUES (
    v_journal_entry_id,
    v_supplier_account_id,
    'Payment to supplier',
    NEW.amount,
    0
  );

  -- Credit Cash/Bank/Mobile Money (reduces asset)
  INSERT INTO journal_entry_lines (
    journal_entry_id,
    account_id,
    description,
    debit_amount,
    credit_amount
  ) VALUES (
    v_journal_entry_id,
    v_payment_account_id,
    'Payment made - ' || NEW.payment_method,
    0,
    NEW.amount
  );

  RETURN NEW;
END;
$function$;