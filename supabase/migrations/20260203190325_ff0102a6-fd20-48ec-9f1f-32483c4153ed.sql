-- Delete duplicate journal entry lines first (foreign key constraint)
DELETE FROM journal_entry_lines 
WHERE journal_entry_id IN (
  '4f6dfc2f-d210-4a41-a2fd-b164368cd5d0',
  '7e1c0122-63de-4aed-8a01-0fa64f18fc03',
  '850cb654-23f2-4f7f-98ea-9ad4cbc68077'
);

-- Delete duplicate closing entries created by historical migration on 2026-02-03
DELETE FROM journal_entries 
WHERE id IN (
  '4f6dfc2f-d210-4a41-a2fd-b164368cd5d0',  -- Duplicate closing for session fe836bf2 (Jan 27)
  '7e1c0122-63de-4aed-8a01-0fa64f18fc03',  -- Duplicate closing for session 2c10d86b (Jan 28)
  '850cb654-23f2-4f7f-98ea-9ad4cbc68077'   -- Duplicate closing for session 0b81a384 (Jan 28)
);

-- Also check and delete duplicate opening entries if they exist
-- First check for original openings for sessions 0b81a384 and 2c10d86b
DELETE FROM journal_entry_lines
WHERE journal_entry_id IN (
  SELECT id FROM journal_entries 
  WHERE description LIKE '%Opening%Session 0b81a384%' 
     OR description LIKE '%Opening%Session 2c10d86b%'
)
AND journal_entry_id IN (
  SELECT je.id FROM journal_entries je
  WHERE je.created_at::date = '2026-02-03'
  AND EXISTS (
    SELECT 1 FROM journal_entries je2 
    WHERE je2.description = je.description 
    AND je2.created_at::date < '2026-02-03'
  )
);

DELETE FROM journal_entries
WHERE (description LIKE '%Opening%Session 0b81a384%' 
    OR description LIKE '%Opening%Session 2c10d86b%')
AND created_at::date = '2026-02-03'
AND EXISTS (
  SELECT 1 FROM journal_entries je2 
  WHERE je2.description = journal_entries.description 
  AND je2.created_at::date < '2026-02-03'
);