-- Clean up duplicate POS transaction journal entries
-- Keep only the first entry for each POS transaction reference
WITH ranked_entries AS (
  SELECT 
    id,
    reference,
    ROW_NUMBER() OVER (PARTITION BY reference ORDER BY created_at, id) as rn
  FROM journal_entries
  WHERE reference LIKE 'POS-%'
    AND description LIKE 'POS Sale - POS-%'
)
DELETE FROM journal_entries
WHERE id IN (
  SELECT id FROM ranked_entries WHERE rn > 1
);