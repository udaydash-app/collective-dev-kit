-- Update cash register opening function to handle merged cash accounts (1010/1110)
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
    -- Get account IDs - handle merged cash accounts (1010 or 1110)
    SELECT id INTO v_cash_account_id 
    FROM accounts 
    WHERE account_code IN ('1010', '1110') 
      AND is_active = true 
    LIMIT 1;
    
    SELECT id INTO v_owner_account_id 
    FROM accounts 
    WHERE account_code = '2010-0D34407DAC' 
    LIMIT 1;
    
    -- Only proceed if we found the cash account
    IF v_cash_account_id IS NULL THEN
      RAISE WARNING 'Cash account (1010 or 1110) not found, skipping journal entry creation';
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
    
    -- Credit: UDAYBHANU DASH (decreases owner's equity) - only if owner account exists
    IF v_owner_account_id IS NOT NULL THEN
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
  END IF;
  
  RETURN NEW;
END;
$$;