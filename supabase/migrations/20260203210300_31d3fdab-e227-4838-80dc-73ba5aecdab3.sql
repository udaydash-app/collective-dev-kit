-- Restore the valid closing entry that was incorrectly deleted
-- This was created by the database trigger (REG-CLOSE-)

-- First get the account IDs
DO $$
DECLARE
  v_cash_account_id UUID;
  v_owner_account_id UUID;
  v_journal_entry_id UUID;
BEGIN
  -- Get account IDs
  SELECT id INTO v_cash_account_id FROM accounts WHERE account_code = '571' LIMIT 1;
  SELECT id INTO v_owner_account_id FROM accounts WHERE account_code = '5711' LIMIT 1;
  
  -- If 5711 doesn't exist, use 109
  IF v_owner_account_id IS NULL THEN
    SELECT id INTO v_owner_account_id FROM accounts WHERE account_code = '109' LIMIT 1;
  END IF;

  -- Insert the journal entry
  INSERT INTO journal_entries (
    id,
    entry_number,
    description,
    entry_date,
    reference,
    total_debit,
    total_credit,
    status,
    posted_at,
    created_at
  ) VALUES (
    '1d19d084-e2eb-4e7b-a74d-2e11399a07c3',
    'JE-1D66D1C56D',
    'Cash Register Closing - Session 9bad43ca-ea30-40e6-bb03-120654a47e1a',
    '2026-02-03',
    'REG-CLOSE-9BAD43CA',
    182000,
    182000,
    'posted',
    '2026-02-03 20:56:42.466657+00',
    '2026-02-03 20:56:42.466657+00'
  )
  RETURNING id INTO v_journal_entry_id;

  -- Insert journal entry lines
  -- Debit: Owner account (5711 or 109)
  INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
  VALUES (v_journal_entry_id, v_owner_account_id, 'Cash returned to owner from register closing', 182000, 0);
  
  -- Credit: Cash account (571)
  INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
  VALUES (v_journal_entry_id, v_cash_account_id, 'Cash removed from register', 0, 182000);

END $$;