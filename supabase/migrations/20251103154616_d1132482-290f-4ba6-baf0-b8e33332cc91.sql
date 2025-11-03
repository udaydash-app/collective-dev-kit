
-- Delete the duplicate journal entry that was auto-created by the trigger
-- Keep the original JE-0153F73121 and delete JE-F98D411795

-- First delete the journal entry lines
DELETE FROM journal_entry_lines
WHERE journal_entry_id = '9553e22b-ad4b-417a-b2b5-1b03f512afe4';

-- Then delete the journal entry itself
DELETE FROM journal_entries
WHERE id = '9553e22b-ad4b-417a-b2b5-1b03f512afe4'
  AND entry_number = 'JE-F98D411795'
  AND reference = 'POS-FAD0ECC6EC';
