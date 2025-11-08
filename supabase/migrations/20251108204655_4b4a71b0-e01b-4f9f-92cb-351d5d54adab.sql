-- Fix INDIAN BAZAAR balance by updating the correct customer account
-- Account 1030-B9C415AB00 has the transactions, so it should have the opening balance
-- Current: Debits 2,648,500 - Credits 3,059,800 = -411,300 net change
-- To get 1,041,700 final balance: opening should be 1,041,700 + 411,300 = 1,453,000

-- First, update the contact opening balance back to original (it was correct)
UPDATE contacts
SET opening_balance = 1453000
WHERE name ILIKE '%INDIAN%BAZAAR%';

-- Update the account with transactions to reflect correct balance
UPDATE accounts
SET current_balance = 1453000 + (
  SELECT COALESCE(SUM(jel.debit_amount), 0) - COALESCE(SUM(jel.credit_amount), 0)
  FROM journal_entry_lines jel
  WHERE jel.account_id = accounts.id
)
WHERE id = '68cdddd4-e7cc-4fde-94af-47aac7b55677';

-- Set the unused account to 0
UPDATE accounts
SET current_balance = 0
WHERE id = '61943a5f-e065-47a1-94a1-fcd2f127c65a';