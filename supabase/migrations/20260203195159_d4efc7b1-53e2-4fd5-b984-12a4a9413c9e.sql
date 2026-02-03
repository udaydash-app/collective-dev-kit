-- Remove duplicate journal entries created by historical migration on Feb 3
-- These are duplicates of entries that already existed from the original triggers

-- Delete journal entry lines first (foreign key constraint)
DELETE FROM journal_entry_lines 
WHERE journal_entry_id IN (
  -- Dec 18 duplicates
  '7a75c1f9-b09f-4380-82a4-b4e04025b9c9', -- REG-CLOSE-F760E17F (duplicate of CASHCLOSE-F760E17F6)
  '419a2674-f775-40cd-a9d1-64b5fdfafd89'  -- REG-OPEN-6D0159A1 (duplicate of CASHREG-6D0159A1CB)
);

-- Delete the duplicate journal entries
DELETE FROM journal_entries 
WHERE id IN (
  '7a75c1f9-b09f-4380-82a4-b4e04025b9c9', -- REG-CLOSE-F760E17F
  '419a2674-f775-40cd-a9d1-64b5fdfafd89'  -- REG-OPEN-6D0159A1
);

-- Also need to revert account balance changes from those duplicates
-- The duplicates added 181,000 closing + 181,500 opening incorrectly
UPDATE accounts 
SET current_balance = current_balance - 181000 -- Revert duplicate closing debit
WHERE account_code = '5711';

UPDATE accounts 
SET current_balance = current_balance + 181000 -- Revert duplicate closing credit
WHERE account_code = '571';

UPDATE accounts 
SET current_balance = current_balance - 181500 -- Revert duplicate opening debit
WHERE account_code = '571';

UPDATE accounts 
SET current_balance = current_balance + 181500 -- Revert duplicate opening credit
WHERE account_code = '5711';