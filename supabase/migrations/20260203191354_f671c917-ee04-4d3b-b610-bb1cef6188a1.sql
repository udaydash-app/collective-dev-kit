
-- Fix: Remove duplicate Jan 27 opening and add missing Jan 28 closing

-- 1. Delete the duplicate journal entry lines for session 2c10d86b (the duplicate)
DELETE FROM journal_entry_lines 
WHERE journal_entry_id = '1cd3c7e4-a8f0-4046-b326-77242a10e2e6';

-- 2. Delete the duplicate opening journal entry for session 2c10d86b
DELETE FROM journal_entries 
WHERE id = '1cd3c7e4-a8f0-4046-b326-77242a10e2e6';

-- 3. Delete the duplicate cash session (created 1 min after the first one)
DELETE FROM cash_sessions 
WHERE id = '2c10d86b-afef-4719-910a-032b3a6df3ce';

-- 4. Create the missing closing entry for session 0b81a384 on Jan 28
-- Get account IDs for the journal entry
DO $$
DECLARE
  v_cash_account_id uuid;
  v_owner_account_id uuid;
  v_entry_id uuid;
BEGIN
  -- Get account 571 (Cash)
  SELECT id INTO v_cash_account_id FROM accounts WHERE account_code = '571' LIMIT 1;
  
  -- Get account 5711 (UDAYBHANU DASH - Cash In Hand)
  SELECT id INTO v_owner_account_id FROM accounts WHERE account_code = '5711' LIMIT 1;
  
  IF v_cash_account_id IS NULL OR v_owner_account_id IS NULL THEN
    RAISE EXCEPTION 'Required accounts not found';
  END IF;
  
  -- Create the closing journal entry for session 0b81a384
  INSERT INTO journal_entries (
    id, entry_number, entry_date, description, reference, 
    total_debit, total_credit, status, created_at, updated_at
  ) VALUES (
    gen_random_uuid(),
    'JE-' || to_char(now(), 'YYYYMMDD') || '-' || floor(random() * 10000)::text,
    '2026-01-28',
    'Cash Register Closing - Session 0b81a384-66b0-47dd-a23e-1b4c268d8578',
    'REG-CLOSE-0B81A384',
    193900,
    193900,
    'posted',
    '2026-01-28 19:59:27.688+00',
    now()
  ) RETURNING id INTO v_entry_id;
  
  -- Create journal entry lines
  -- Debit 5711 (Owner receives cash back)
  INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description)
  VALUES (v_entry_id, v_owner_account_id, 193900, 0, 'Cash returned from register');
  
  -- Credit 571 (Cash leaves register)
  INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description)
  VALUES (v_entry_id, v_cash_account_id, 0, 193900, 'Cash returned from register');
  
  -- Update account balances
  UPDATE accounts SET current_balance = current_balance + 193900 WHERE id = v_owner_account_id;
  UPDATE accounts SET current_balance = current_balance - 193900 WHERE id = v_cash_account_id;
END $$;
