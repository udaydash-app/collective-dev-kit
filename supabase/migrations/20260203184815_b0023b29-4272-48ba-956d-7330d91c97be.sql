-- Create historical closing journal entries for cash sessions closed after Dec 12, 2025
-- that have closing_cash > 0 (set created_by to NULL for historical entries)

DO $$
DECLARE
  v_cash_account_id UUID;
  v_owner_cash_account_id UUID;
  v_journal_entry_id UUID;
  v_session RECORD;
BEGIN
  -- Get Cash account (571)
  SELECT id INTO v_cash_account_id 
  FROM accounts 
  WHERE account_code = '571' AND is_active = true 
  LIMIT 1;
  
  -- Get UDAYBHANU DASH Cash In Hand account (5711)
  SELECT id INTO v_owner_cash_account_id 
  FROM accounts 
  WHERE account_code = '5711' AND is_active = true 
  LIMIT 1;
  
  IF v_cash_account_id IS NULL OR v_owner_cash_account_id IS NULL THEN
    RAISE EXCEPTION 'Required accounts not found';
  END IF;
  
  -- Loop through all closed sessions after Dec 12, 2025 with closing_cash > 0
  FOR v_session IN 
    SELECT id, closed_at, closing_cash 
    FROM cash_sessions 
    WHERE status = 'closed' 
      AND closed_at >= '2025-12-12'
      AND closing_cash > 0
    ORDER BY closed_at
  LOOP
    -- Check if closing entry already exists
    IF NOT EXISTS (
      SELECT 1 FROM journal_entries 
      WHERE reference = 'REG-CLOSE-' || UPPER(SUBSTRING(REPLACE(v_session.id::text, '-', '') FROM 1 FOR 8))
    ) THEN
      -- Create journal entry for closing (no created_by/posted_by for historical)
      INSERT INTO journal_entries (
        description,
        entry_date,
        reference,
        total_debit,
        total_credit,
        status,
        posted_at
      ) VALUES (
        'Cash Register Closing - Session ' || v_session.id,
        DATE(v_session.closed_at),
        'REG-CLOSE-' || UPPER(SUBSTRING(REPLACE(v_session.id::text, '-', '') FROM 1 FOR 8)),
        v_session.closing_cash,
        v_session.closing_cash,
        'posted',
        v_session.closed_at
      ) RETURNING id INTO v_journal_entry_id;
      
      -- Debit: UDAYBHANU DASH (5711) - cash returned to owner
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
      VALUES (v_journal_entry_id, v_owner_cash_account_id, 'Cash collected from register', v_session.closing_cash, 0);
      
      -- Credit: Cash (571) - cash leaves register
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
      VALUES (v_journal_entry_id, v_cash_account_id, 'Register closing cash', 0, v_session.closing_cash);
    END IF;
  END LOOP;
END $$;