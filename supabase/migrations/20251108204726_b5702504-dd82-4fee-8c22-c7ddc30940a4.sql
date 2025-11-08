-- Set correct opening balance to achieve 1,041,700 target
-- Current net change: +90,700
-- Target balance: 1,041,700
-- Required opening: 1,041,700 - 90,700 = 951,000

UPDATE contacts
SET opening_balance = 951000
WHERE name ILIKE '%INDIAN%BAZAAR%';

-- Update the main account balance
UPDATE accounts
SET current_balance = 951000 + (
  SELECT COALESCE(SUM(jel.debit_amount), 0) - COALESCE(SUM(jel.credit_amount), 0)
  FROM journal_entry_lines jel
  WHERE jel.account_id = '68cdddd4-e7cc-4fde-94af-47aac7b55677'
)
WHERE id = '68cdddd4-e7cc-4fde-94af-47aac7b55677';