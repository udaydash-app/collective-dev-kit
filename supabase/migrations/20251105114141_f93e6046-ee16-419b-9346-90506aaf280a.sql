
-- Recalculate all account balances from posted journal entries
-- This will fix the missing balances for opening balance journal entries

UPDATE accounts
SET current_balance = (
  SELECT COALESCE(
    SUM(
      CASE 
        WHEN accounts.account_type IN ('asset', 'expense') THEN 
          jel.debit_amount - jel.credit_amount
        ELSE 
          jel.credit_amount - jel.debit_amount
      END
    ), 0
  )
  FROM journal_entry_lines jel
  JOIN journal_entries je ON je.id = jel.journal_entry_id
  WHERE jel.account_id = accounts.id
    AND je.status = 'posted'
)
WHERE EXISTS (
  SELECT 1
  FROM journal_entry_lines jel
  JOIN journal_entries je ON je.id = jel.journal_entry_id
  WHERE jel.account_id = accounts.id
    AND je.status = 'posted'
);
