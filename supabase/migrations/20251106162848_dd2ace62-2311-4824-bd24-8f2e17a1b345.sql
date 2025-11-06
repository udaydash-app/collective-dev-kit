-- Update payment receipt trigger to handle DELETE operations
CREATE OR REPLACE FUNCTION public.create_payment_receipt_journal_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cash_account_id UUID;
  v_mobile_money_account_id UUID;
  v_bank_account_id UUID;
  v_customer_account_id UUID;
  v_journal_entry_id UUID;
  v_payment_account_id UUID;
BEGIN
  -- Handle DELETE - remove the associated journal entry
  IF TG_OP = 'DELETE' THEN
    DELETE FROM journal_entries 
    WHERE reference = OLD.receipt_number 
      AND description = 'Payment Receipt - ' || OLD.receipt_number;
    RETURN OLD;
  END IF;

  -- Handle UPDATE - delete old journal entry first
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM journal_entries 
    WHERE reference = OLD.receipt_number 
      AND description = 'Payment Receipt - ' || OLD.receipt_number;
  END IF;

  -- Get account IDs
  SELECT id INTO v_cash_account_id FROM accounts WHERE account_code = '1010' LIMIT 1;
  SELECT id INTO v_mobile_money_account_id FROM accounts WHERE account_code = '1015' LIMIT 1;
  SELECT id INTO v_bank_account_id FROM accounts WHERE account_code = '1011' LIMIT 1;
  
  -- Get customer ledger account
  SELECT customer_ledger_account_id INTO v_customer_account_id 
  FROM contacts 
  WHERE id = NEW.contact_id;

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
    'Payment Receipt - ' || NEW.receipt_number,
    NEW.payment_date,
    NEW.receipt_number,
    NEW.amount,
    NEW.amount,
    'posted',
    NEW.received_by,
    NEW.received_by,
    NOW()
  ) RETURNING id INTO v_journal_entry_id;

  -- Debit Cash/Bank/Mobile Money
  INSERT INTO journal_entry_lines (
    journal_entry_id,
    account_id,
    description,
    debit_amount,
    credit_amount
  ) VALUES (
    v_journal_entry_id,
    v_payment_account_id,
    'Payment received - ' || NEW.payment_method,
    NEW.amount,
    0
  );

  -- Credit Customer Account (Accounts Receivable)
  INSERT INTO journal_entry_lines (
    journal_entry_id,
    account_id,
    description,
    debit_amount,
    credit_amount
  ) VALUES (
    v_journal_entry_id,
    v_customer_account_id,
    'Payment from customer',
    0,
    NEW.amount
  );

  RETURN NEW;
END;
$function$;