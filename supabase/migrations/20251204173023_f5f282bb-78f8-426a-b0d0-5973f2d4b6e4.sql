-- Clean up duplicate journal entries by keeping only the first one for each reference
-- This removes duplicates created by both frontend and triggers

-- First, delete duplicate journal entry lines for entries we're about to delete
DELETE FROM journal_entry_lines 
WHERE journal_entry_id IN (
  SELECT id FROM (
    SELECT id, reference, ROW_NUMBER() OVER (PARTITION BY reference ORDER BY created_at ASC) as rn
    FROM journal_entries
    WHERE reference IS NOT NULL AND reference != ''
  ) ranked
  WHERE rn > 1
);

-- Then delete the duplicate journal entries themselves (keeping the first one)
DELETE FROM journal_entries 
WHERE id IN (
  SELECT id FROM (
    SELECT id, reference, ROW_NUMBER() OVER (PARTITION BY reference ORDER BY created_at ASC) as rn
    FROM journal_entries
    WHERE reference IS NOT NULL AND reference != ''
  ) ranked
  WHERE rn > 1
);