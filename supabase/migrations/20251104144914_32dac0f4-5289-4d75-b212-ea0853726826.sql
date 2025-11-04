
-- Delete duplicate POS journal entries, keeping only the first one per reference
WITH ranked_entries AS (
  SELECT 
    id,
    reference,
    ROW_NUMBER() OVER (PARTITION BY reference ORDER BY created_at, id) as rn
  FROM journal_entries
  WHERE reference LIKE 'POS-%'
)
DELETE FROM journal_entries
WHERE id IN (
  SELECT id FROM ranked_entries WHERE rn > 1
);
