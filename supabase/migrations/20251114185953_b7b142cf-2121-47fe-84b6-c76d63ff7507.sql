-- Delete journal entry for today's session if it was created by historical migration
-- This prevents double-entry for today's active session
DELETE FROM journal_entry_lines 
WHERE journal_entry_id IN (
  SELECT id FROM journal_entries 
  WHERE reference LIKE 'CASHREG-5FC4F4F8%' 
    AND entry_date = CURRENT_DATE
    AND description LIKE '%5fc4f4f8-8d22-40e4-aab2-b1773c324de6%'
);

DELETE FROM journal_entries 
WHERE reference LIKE 'CASHREG-5FC4F4F8%' 
  AND entry_date = CURRENT_DATE
  AND description LIKE '%5fc4f4f8-8d22-40e4-aab2-b1773c324de6%';