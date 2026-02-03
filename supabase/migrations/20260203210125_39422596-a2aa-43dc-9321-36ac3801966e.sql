-- Delete duplicate CASHCLOSE journal entries that were created by frontend
-- (Database trigger already creates REG-CLOSE entries)

-- First delete the journal entry lines
DELETE FROM journal_entry_lines 
WHERE journal_entry_id IN (
  SELECT id FROM journal_entries 
  WHERE entry_number IN ('JE-9E0EF375D8', 'JE-1D66D1C56D')
);

-- Then delete the journal entries
DELETE FROM journal_entries 
WHERE entry_number IN ('JE-9E0EF375D8', 'JE-1D66D1C56D');