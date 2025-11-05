
-- Delete orphan Sudha account that has no linked contact
-- This account was created as a duplicate and causes display issues
DELETE FROM accounts 
WHERE id = 'ab3f48ad-0e5a-4935-ae72-d17cf789ed5f'
  AND account_name = 'SUDHA REDDY BOUAKE (Customer)'
  AND NOT EXISTS (
    SELECT 1 FROM contacts 
    WHERE customer_ledger_account_id = 'ab3f48ad-0e5a-4935-ae72-d17cf789ed5f'
  );
