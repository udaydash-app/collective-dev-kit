
-- First, drop and recreate the opening entry trigger with correct logic
DROP TRIGGER IF EXISTS trigger_cash_register_opening ON cash_sessions;
DROP FUNCTION IF EXISTS create_cash_register_opening_entry();

-- Create function to generate opening journal entry
CREATE OR REPLACE FUNCTION create_cash_register_opening_entry()
RETURNS TRIGGER AS $$
DECLARE
  v_cash_account_id UUID;
  v_owner_cash_account_id UUID;
  v_journal_entry_id UUID;
  v_ref TEXT;
BEGIN
  -- Only create entry for new sessions with opening_cash > 0
  IF NEW.opening_cash IS NULL OR NEW.opening_cash <= 0 THEN
    RETURN NEW;
  END IF;
  
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
    RAISE WARNING 'Required accounts (571, 5711) not found for cash register opening';
    RETURN NEW;
  END IF;
  
  v_ref := 'REG-OPEN-' || UPPER(SUBSTRING(REPLACE(NEW.id::text, '-', '') FROM 1 FOR 8));
  
  -- Create journal entry
  INSERT INTO journal_entries (
    description,
    entry_date,
    reference,
    total_debit,
    total_credit,
    status,
    posted_at,
    created_by,
    posted_by
  ) VALUES (
    'Cash Register Opening - Session ' || NEW.id,
    DATE(NEW.opened_at),
    v_ref,
    NEW.opening_cash,
    NEW.opening_cash,
    'posted',
    NEW.opened_at,
    NEW.cashier_id,
    NEW.cashier_id
  ) RETURNING id INTO v_journal_entry_id;
  
  -- Debit: Cash (571) - cash goes into register
  INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
  VALUES (v_journal_entry_id, v_cash_account_id, 'Cash placed in register', NEW.opening_cash, 0);
  
  -- Credit: UDAYBHANU DASH (5711) - cash comes from owner
  INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
  VALUES (v_journal_entry_id, v_owner_cash_account_id, 'Owner cash to register', 0, NEW.opening_cash);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for INSERT on cash_sessions
CREATE TRIGGER trigger_cash_register_opening
  AFTER INSERT ON cash_sessions
  FOR EACH ROW
  EXECUTE FUNCTION create_cash_register_opening_entry();

-- Now create historical opening entries for all sessions since Dec 12, 2025
DO $$
DECLARE
  v_cash_account_id UUID;
  v_owner_cash_account_id UUID;
  v_journal_entry_id UUID;
  v_session RECORD;
  v_ref TEXT;
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
  
  -- Loop through all sessions since Dec 12, 2025 with opening_cash > 0
  FOR v_session IN 
    SELECT id, opened_at, opening_cash 
    FROM cash_sessions 
    WHERE opened_at >= '2025-12-12'
      AND opening_cash > 0
    ORDER BY opened_at
  LOOP
    v_ref := 'REG-OPEN-' || UPPER(SUBSTRING(REPLACE(v_session.id::text, '-', '') FROM 1 FOR 8));
    
    -- Check if opening entry already exists
    IF NOT EXISTS (
      SELECT 1 FROM journal_entries WHERE reference = v_ref
    ) THEN
      -- Create journal entry for opening
      INSERT INTO journal_entries (
        description,
        entry_date,
        reference,
        total_debit,
        total_credit,
        status,
        posted_at
      ) VALUES (
        'Cash Register Opening - Session ' || v_session.id,
        DATE(v_session.opened_at),
        v_ref,
        v_session.opening_cash,
        v_session.opening_cash,
        'posted',
        v_session.opened_at
      ) RETURNING id INTO v_journal_entry_id;
      
      -- Debit: Cash (571) - cash goes into register
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
      VALUES (v_journal_entry_id, v_cash_account_id, 'Cash placed in register', v_session.opening_cash, 0);
      
      -- Credit: UDAYBHANU DASH (5711) - cash comes from owner
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
      VALUES (v_journal_entry_id, v_owner_cash_account_id, 'Owner cash to register', 0, v_session.opening_cash);
    END IF;
  END LOOP;
END $$;
