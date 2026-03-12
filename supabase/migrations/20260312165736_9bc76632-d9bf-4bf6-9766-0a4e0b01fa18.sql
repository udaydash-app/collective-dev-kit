
CREATE OR REPLACE FUNCTION public.create_cash_register_closing_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_cash_account_id UUID;
  v_owner_cash_account_id UUID;
  v_over_short_account_id UUID;
  v_closing_je_id UUID;
  v_diff_je_id UUID;
  v_difference NUMERIC;
  v_close_ref TEXT;
  v_diff_ref TEXT;
BEGIN
  -- Only fire when status changes to 'closed' and closing_cash is set
  IF NEW.status = 'closed' AND OLD.status = 'open' AND NEW.closing_cash IS NOT NULL AND NEW.closing_cash > 0 THEN

    -- Fetch required accounts
    SELECT id INTO v_cash_account_id FROM accounts WHERE account_code = '571' AND is_active = true LIMIT 1;
    SELECT id INTO v_owner_cash_account_id FROM accounts WHERE account_code = '5711' AND is_active = true LIMIT 1;
    SELECT id INTO v_over_short_account_id FROM accounts WHERE account_code = '7799' AND is_active = true LIMIT 1;

    IF v_cash_account_id IS NULL OR v_owner_cash_account_id IS NULL THEN
      RAISE WARNING 'Required accounts (571, 5711) not found for cash register closing';
      RETURN NEW;
    END IF;

    -- Round difference to 2 decimal places to eliminate floating-point noise
    v_difference := ROUND(COALESCE(NEW.cash_difference, 0)::NUMERIC, 2);

    v_close_ref := 'REG-CLOSE-' || UPPER(SUBSTRING(REPLACE(NEW.id::text, '-', '') FROM 1 FOR 8));

    -- ── Entry 1: Physical cash transfer (actual closing cash, no Over/Short) ──
    INSERT INTO journal_entries (
      description, entry_date, reference,
      total_debit, total_credit, status,
      created_by, posted_by, posted_at
    ) VALUES (
      'Cash Register Closing - Session ' || NEW.id,
      DATE(NEW.closed_at),
      v_close_ref,
      NEW.closing_cash, NEW.closing_cash,
      'posted',
      NEW.cashier_id, NEW.cashier_id, NEW.closed_at
    ) RETURNING id INTO v_closing_je_id;

    -- Debit 5711 (Cash In Hand) — cash returned to owner
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
    VALUES (v_closing_je_id, v_owner_cash_account_id, 'Cash collected from register', NEW.closing_cash, 0);

    -- Credit 571 (Cash) — cash leaves the register
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
    VALUES (v_closing_je_id, v_cash_account_id, 'Register closing cash', 0, NEW.closing_cash);

    -- ── Entry 2 (only when actual ≠ expected): Record difference in Over/Short ──
    IF v_difference != 0 AND v_over_short_account_id IS NOT NULL THEN

      v_diff_ref := CASE WHEN v_difference > 0 THEN 'REG-OVER-' ELSE 'REG-SHORT-' END
                   || UPPER(SUBSTRING(REPLACE(NEW.id::text, '-', '') FROM 1 FOR 8));

      INSERT INTO journal_entries (
        description, entry_date, reference,
        total_debit, total_credit, status,
        created_by, posted_by, posted_at
      ) VALUES (
        CASE WHEN v_difference > 0
          THEN 'Cash Overage - Session ' || NEW.id || ' (+' || v_difference::text || ')'
          ELSE 'Cash Shortage - Session ' || NEW.id || ' (' || v_difference::text || ')'
        END,
        DATE(NEW.closed_at),
        v_diff_ref,
        ABS(v_difference), ABS(v_difference),
        'posted',
        NEW.cashier_id, NEW.cashier_id, NEW.closed_at
      ) RETURNING id INTO v_diff_je_id;

      IF v_difference > 0 THEN
        -- Overage: physical cash > expected → income
        INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
        VALUES (v_diff_je_id, v_owner_cash_account_id,
          'Cash overage (' || v_difference::text || ')', v_difference, 0);
        INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
        VALUES (v_diff_je_id, v_over_short_account_id,
          'Cash over - excess cash in register', 0, v_difference);
      ELSE
        -- Shortage: physical cash < expected → expense
        INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
        VALUES (v_diff_je_id, v_over_short_account_id,
          'Cash short - missing from register', ABS(v_difference), 0);
        INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
        VALUES (v_diff_je_id, v_owner_cash_account_id,
          'Cash shortage (' || ABS(v_difference)::text || ')', 0, ABS(v_difference));
      END IF;
    END IF;

  END IF;

  RETURN NEW;
END;
$function$;
