-- One-time cleanup: Recalculate account balances after fixing duplicate journal entries
-- This will force a recalculation of all account balances from journal entries

-- First, let's update all account balances based on actual journal entries
DO $$
DECLARE
  v_account RECORD;
  v_balance NUMERIC;
BEGIN
  -- Loop through all accounts that have journal entries
  FOR v_account IN 
    SELECT DISTINCT a.id, a.account_type, a.parent_account_id
    FROM accounts a
    INNER JOIN journal_entry_lines jel ON jel.account_id = a.id
    INNER JOIN journal_entries je ON je.id = jel.journal_entry_id
    WHERE je.status = 'posted'
  LOOP
    -- Calculate balance based on account type
    IF v_account.account_type IN ('asset', 'expense') THEN
      -- For assets and expenses: balance = debits - credits
      SELECT COALESCE(SUM(jel.debit_amount - jel.credit_amount), 0)
      INTO v_balance
      FROM journal_entry_lines jel
      INNER JOIN journal_entries je ON je.id = jel.journal_entry_id
      WHERE jel.account_id = v_account.id
        AND je.status = 'posted';
    ELSE
      -- For liabilities, equity, revenue: balance = credits - debits
      SELECT COALESCE(SUM(jel.credit_amount - jel.debit_amount), 0)
      INTO v_balance
      FROM journal_entry_lines jel
      INNER JOIN journal_entries je ON je.id = jel.journal_entry_id
      WHERE jel.account_id = v_account.id
        AND je.status = 'posted';
    END IF;
    
    -- Update the account balance
    UPDATE accounts
    SET current_balance = v_balance
    WHERE id = v_account.id;
  END LOOP;
END;
$$;