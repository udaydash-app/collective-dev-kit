
CREATE OR REPLACE FUNCTION public.create_cash_register_closing_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_cash_account_id UUID;
  v_owner_cash_account_id UUID;
  v_over_short_account_id UUID;
  v_journal_entry_id UUID;
  v_difference NUMERIC;
  v_expected NUMERIC;
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
    
    -- Get Cash In Hand account (5711)
    SELECT id INTO v_owner_cash_account_id 
    FROM accounts 
    WHERE account_code = '5711' AND is_active = true 
    LIMIT 1;
    
    IF v_owner_cash_account_id IS NULL THEN
      RAISE WARNING 'Owner cash account (5711) not found, skipping journal entry';
      RETURN NEW;
    END IF;

    -- Get Cash Over/Short account (7799)
    SELECT id INTO v_over_short_account_id
    FROM accounts
    WHERE account_code = '7799' AND is_active = true
    LIMIT 1;

    -- Round the difference to 2 decimal places to avoid floating-point noise
    -- Difference = actual cash entered by user - system expected cash
    v_difference := ROUND(COALESCE(NEW.cash_difference, 0)::NUMERIC, 2);

    -- Use expected_cash as the base register transfer amount.
    -- If expected_cash is not stored or is zero/negative, fall back to closing_cash.
    v_expected := COALESCE(NEW.expected_cash, NEW.closing_cash);
    IF v_expected <= 0 THEN
      v_expected := NEW.closing_cash;
    END IF;

    -- Create the base closing journal entry using the expected cash amount
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
      'Cash Register Closing - Session ' || NEW.id ||
        CASE 
          WHEN v_difference > 0 THEN ' [OVER: +' || v_difference::text || ']'
          WHEN v_difference < 0 THEN ' [SHORT: ' || v_difference::text || ']'
          ELSE ''
        END,
      DATE(NEW.closed_at),
      'REG-CLOSE-' || UPPER(SUBSTRING(REPLACE(NEW.id::text, '-', '') FROM 1 FOR 8)),
      v_expected,
      v_expected,
      'posted',
      NEW.cashier_id,
      NEW.cashier_id,
      NEW.closed_at
    ) RETURNING id INTO v_journal_entry_id;

    -- Debit: 5711 (Cash In Hand) — expected cash returned to owner
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
    VALUES (v_journal_entry_id, v_owner_cash_account_id, 'Cash collected from register (expected)', v_expected, 0);

    -- Credit: 571 (Cash) — expected cash leaves the register
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
    VALUES (v_journal_entry_id, v_cash_account_id, 'Register closing cash (expected)', 0, v_expected);

    -- Handle discrepancy ONLY when actual cash differs from expected
    IF v_difference != 0 AND v_over_short_account_id IS NOT NULL THEN
      IF v_difference > 0 THEN
        -- Cash OVER: physical cash > expected
        -- Extra cash goes to owner (Debit 5711) and recorded as income (Credit 7799)
        INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
        VALUES (v_journal_entry_id, v_owner_cash_account_id,
          'Cash overage (' || v_difference::text || ')', v_difference, 0);
        INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
        VALUES (v_journal_entry_id, v_over_short_account_id,
          'Cash over - excess cash in register (' || v_difference::text || ')', 0, v_difference);
        -- Keep entry balanced
        UPDATE journal_entries
        SET total_debit = total_debit + v_difference,
            total_credit = total_credit + v_difference
        WHERE id = v_journal_entry_id;
      ELSE
        -- Cash SHORT: physical cash < expected
        -- Missing cash is an expense (Debit 7799) offset against owner account (Credit 5711)
        INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
        VALUES (v_journal_entry_id, v_over_short_account_id,
          'Cash short - missing from register (' || ABS(v_difference)::text || ')', ABS(v_difference), 0);
        INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
        VALUES (v_journal_entry_id, v_owner_cash_account_id,
          'Cash shortage (' || ABS(v_difference)::text || ')', 0, ABS(v_difference));
        -- Keep entry balanced
        UPDATE journal_entries
        SET total_debit = total_debit + ABS(v_difference),
            total_credit = total_credit + ABS(v_difference)
        WHERE id = v_journal_entry_id;
      END IF;
    END IF;

  END IF;
  
  RETURN NEW;
END;
$function$;
