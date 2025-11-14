-- Create function to automatically create journal entry when opening cash register
CREATE OR REPLACE FUNCTION public.create_cash_register_opening_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cash_account_id UUID;
  v_owner_account_id UUID;
  v_journal_entry_id UUID;
BEGIN
  -- Only create entry if opening_cash > 0 and it's a new INSERT
  IF NEW.opening_cash > 0 AND TG_OP = 'INSERT' THEN
    -- Get account IDs
    SELECT id INTO v_cash_account_id FROM accounts WHERE account_code = '1010' LIMIT 1;
    SELECT id INTO v_owner_account_id FROM accounts WHERE account_code = '2010-0D34407DAC' LIMIT 1; -- UDAYBHANU DASH account
    
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
      'Cash Register Opening - Session ' || NEW.id,
      DATE(NEW.opened_at),
      'CASHREG-' || UPPER(SUBSTRING(REPLACE(NEW.id::text, '-', '') FROM 1 FOR 10)),
      NEW.opening_cash,
      NEW.opening_cash,
      'posted',
      NEW.cashier_id,
      NEW.cashier_id,
      NEW.opened_at
    ) RETURNING id INTO v_journal_entry_id;
    
    -- Debit: Cash (increases cash on hand)
    INSERT INTO journal_entry_lines (
      journal_entry_id,
      account_id,
      description,
      debit_amount,
      credit_amount
    ) VALUES (
      v_journal_entry_id,
      v_cash_account_id,
      'Cash received for register opening',
      NEW.opening_cash,
      0
    );
    
    -- Credit: UDAYBHANU DASH (decreases owner's equity)
    INSERT INTO journal_entry_lines (
      journal_entry_id,
      account_id,
      description,
      debit_amount,
      credit_amount
    ) VALUES (
      v_journal_entry_id,
      v_owner_account_id,
      'Cash withdrawn for register',
      0,
      NEW.opening_cash
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on cash_sessions table
DROP TRIGGER IF EXISTS trigger_cash_register_opening ON cash_sessions;
CREATE TRIGGER trigger_cash_register_opening
  AFTER INSERT ON cash_sessions
  FOR EACH ROW
  EXECUTE FUNCTION create_cash_register_opening_entry();

-- Deactivate test account 1110
UPDATE accounts 
SET is_active = false, 
    updated_at = NOW()
WHERE account_code = '1110';