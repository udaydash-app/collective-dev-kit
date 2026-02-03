-- Update cash register opening entry to use UDAYBHANU DASH account (5711)
-- and create closing entry trigger

-- Drop and recreate the opening function
CREATE OR REPLACE FUNCTION public.create_cash_register_opening_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cash_account_id UUID;
  v_owner_cash_account_id UUID;
  v_journal_entry_id UUID;
BEGIN
  -- Only create entry if opening_cash > 0 and it's a new INSERT
  IF NEW.opening_cash > 0 AND TG_OP = 'INSERT' THEN
    -- Get Cash account (571)
    SELECT id INTO v_cash_account_id 
    FROM accounts 
    WHERE account_code = '571' AND is_active = true 
    LIMIT 1;
    
    IF v_cash_account_id IS NULL THEN
      RAISE WARNING 'Cash account (571) not found, skipping journal entry';
      RETURN NEW;
    END IF;
    
    -- Get UDAYBHANU DASH Cash In Hand account (5711)
    SELECT id INTO v_owner_cash_account_id 
    FROM accounts 
    WHERE account_code = '5711' AND is_active = true 
    LIMIT 1;
    
    IF v_owner_cash_account_id IS NULL THEN
      RAISE WARNING 'Owner cash account (5711) not found, skipping journal entry';
      RETURN NEW;
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
      'Cash Register Opening - Session ' || NEW.id,
      DATE(NEW.opened_at),
      'REG-OPEN-' || UPPER(SUBSTRING(REPLACE(NEW.id::text, '-', '') FROM 1 FOR 8)),
      NEW.opening_cash,
      NEW.opening_cash,
      'posted',
      NEW.cashier_id,
      NEW.cashier_id,
      NEW.opened_at
    ) RETURNING id INTO v_journal_entry_id;
    
    -- Debit: Cash (571) - cash comes into register
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
    VALUES (v_journal_entry_id, v_cash_account_id, 'Opening cash received', NEW.opening_cash, 0);
    
    -- Credit: UDAYBHANU DASH (5711) - deducted from owner's cash in hand
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
    VALUES (v_journal_entry_id, v_owner_cash_account_id, 'Cash transferred to register', 0, NEW.opening_cash);
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create function for cash register closing
CREATE OR REPLACE FUNCTION public.create_cash_register_closing_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cash_account_id UUID;
  v_owner_cash_account_id UUID;
  v_journal_entry_id UUID;
BEGIN
  -- Only create entry when status changes to 'closed' and closing_cash is set
  IF NEW.status = 'closed' AND OLD.status = 'open' AND NEW.closing_cash IS NOT NULL AND NEW.closing_cash > 0 THEN
    -- Get Cash account (571)
    SELECT id INTO v_cash_account_id 
    FROM accounts 
    WHERE account_code = '571' AND is_active = true 
    LIMIT 1;
    
    IF v_cash_account_id IS NULL THEN
      RAISE WARNING 'Cash account (571) not found, skipping journal entry';
      RETURN NEW;
    END IF;
    
    -- Get UDAYBHANU DASH Cash In Hand account (5711)
    SELECT id INTO v_owner_cash_account_id 
    FROM accounts 
    WHERE account_code = '5711' AND is_active = true 
    LIMIT 1;
    
    IF v_owner_cash_account_id IS NULL THEN
      RAISE WARNING 'Owner cash account (5711) not found, skipping journal entry';
      RETURN NEW;
    END IF;
    
    -- Create journal entry for closing
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
      'Cash Register Closing - Session ' || NEW.id,
      DATE(NEW.closed_at),
      'REG-CLOSE-' || UPPER(SUBSTRING(REPLACE(NEW.id::text, '-', '') FROM 1 FOR 8)),
      NEW.closing_cash,
      NEW.closing_cash,
      'posted',
      NEW.cashier_id,
      NEW.cashier_id,
      NEW.closed_at
    ) RETURNING id INTO v_journal_entry_id;
    
    -- Debit: UDAYBHANU DASH (5711) - cash returned to owner's hand
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
    VALUES (v_journal_entry_id, v_owner_cash_account_id, 'Cash collected from register', NEW.closing_cash, 0);
    
    -- Credit: Cash (571) - cash leaves the register
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
    VALUES (v_journal_entry_id, v_cash_account_id, 'Register closing cash', 0, NEW.closing_cash);
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger for closing (if not exists)
DROP TRIGGER IF EXISTS trigger_cash_register_closing ON cash_sessions;
CREATE TRIGGER trigger_cash_register_closing
  AFTER UPDATE ON cash_sessions
  FOR EACH ROW
  EXECUTE FUNCTION create_cash_register_closing_entry();