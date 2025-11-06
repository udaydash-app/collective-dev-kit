-- Fix journal entry JE-A25370F127 to use correct accounts
-- This journal entry is for payment receipt PMT-CC558F39DB

-- Get the journal entry ID
DO $$
DECLARE
  v_journal_entry_id uuid;
  v_mobile_money_account_id uuid;
  v_customer_account_id uuid;
BEGIN
  -- Get journal entry ID
  SELECT id INTO v_journal_entry_id
  FROM journal_entries
  WHERE entry_number = 'JE-A25370F127';

  -- Get Mobile Money account (1015)
  SELECT id INTO v_mobile_money_account_id
  FROM accounts
  WHERE account_code = '1015';

  -- Get customer's ledger account
  SELECT c.customer_ledger_account_id INTO v_customer_account_id
  FROM payment_receipts pr
  JOIN contacts c ON pr.contact_id = c.id
  WHERE pr.receipt_number = 'PMT-CC558F39DB';

  -- Delete existing incorrect journal entry lines
  DELETE FROM journal_entry_lines
  WHERE journal_entry_id = v_journal_entry_id;

  -- Insert correct journal entry lines
  INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description)
  VALUES
    (v_journal_entry_id, v_mobile_money_account_id, 1500000, 0, 'Payment received - mobile_money'),
    (v_journal_entry_id, v_customer_account_id, 0, 1500000, 'Payment from customer');
END $$;