-- Delete the duplicate supplier payment journal entry created by frontend (has empty reference)
-- The trigger-created one has reference SPM-E28D4E32E6

-- First delete the journal entry lines
DELETE FROM journal_entry_lines 
WHERE journal_entry_id = (
  SELECT id FROM journal_entries WHERE entry_number = 'JE-AFEBE57BBC'
);

-- Then delete the journal entry
DELETE FROM journal_entries WHERE entry_number = 'JE-AFEBE57BBC';