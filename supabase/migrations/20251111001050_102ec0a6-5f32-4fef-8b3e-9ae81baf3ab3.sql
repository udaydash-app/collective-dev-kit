
-- Delete duplicate opening balance journal entry for INDIAN BAZAAR
-- This entry was incorrectly duplicating the opening balance that already exists in the contacts table
DELETE FROM journal_entry_lines 
WHERE journal_entry_id = (
  SELECT id FROM journal_entries WHERE entry_number = 'JE-38B71763F3'
);

DELETE FROM journal_entries 
WHERE entry_number = 'JE-38B71763F3';

-- Recalculate INDIAN BAZAAR customer account balance
-- The balance will be automatically updated by the existing trigger when we touch the account
UPDATE accounts 
SET updated_at = now() 
WHERE id = '68cdddd4-e7cc-4fde-94af-47aac7b55677';
