
-- 1. Delete all REG-OVER and REG-SHORT journal entry lines and entries
DELETE FROM journal_entry_lines
WHERE journal_entry_id IN (
  SELECT id FROM journal_entries
  WHERE reference LIKE 'REG-OVER-%' OR reference LIKE 'REG-SHORT-%'
);

DELETE FROM journal_entries
WHERE reference LIKE 'REG-OVER-%' OR reference LIKE 'REG-SHORT-%';

-- 2. Update the closing trigger to only record physical cash transfer (no overage/shortage)
CREATE OR REPLACE FUNCTION public.create_cash_register_closing_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_cash_account_id UUID;
  v_owner_cash_account_id UUID;
  v_journal_entry_id UUID;
  v_close_ref TEXT;
BEGIN
  -- Only fire when session is being closed
  IF NEW.status != 'closed' OR OLD.status = 'closed' THEN
    RETURN NEW;
  END IF;

  IF NEW.closing_cash IS NULL OR NEW.closing_cash <= 0 THEN
    RETURN NEW;
  END IF;

  -- Get Cash account (571)
  SELECT id INTO v_cash_account_id
  FROM accounts
  WHERE account_code = '571' AND is_active = true
  LIMIT 1;

  -- Get Cash In Hand account (5711)
  SELECT id INTO v_owner_cash_account_id
  FROM accounts
  WHERE account_code = '5711' AND is_active = true
  LIMIT 1;

  IF v_cash_account_id IS NULL OR v_owner_cash_account_id IS NULL THEN
    RAISE WARNING 'Required accounts (571, 5711) not found for cash register closing';
    RETURN NEW;
  END IF;

  v_close_ref := 'REG-CLOSE-' || UPPER(SUBSTRING(REPLACE(NEW.id::text, '-', '') FROM 1 FOR 8));

  -- Delete any existing closing entry for this session (idempotent)
  DELETE FROM journal_entries WHERE reference = v_close_ref;

  -- Entry: Physical cash transfer (closing_cash)
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
    'Cash Register Closing - Session ' || NEW.id,
    DATE(COALESCE(NEW.closed_at, now())),
    v_close_ref,
    NEW.closing_cash,
    NEW.closing_cash,
    'posted',
    COALESCE(NEW.closed_at, now()),
    NEW.cashier_id,
    NEW.cashier_id
  ) RETURNING id INTO v_journal_entry_id;

  -- Debit: Cash In Hand (5711)
  INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
  VALUES (v_journal_entry_id, v_owner_cash_account_id, 'Cash collected from register', NEW.closing_cash, 0);

  -- Credit: Cash (571)
  INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
  VALUES (v_journal_entry_id, v_cash_account_id, 'Register closing cash', 0, NEW.closing_cash);

  RETURN NEW;
END;
$function$;
