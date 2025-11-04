-- Delete duplicate journal entries, keeping only the oldest one for each reference
WITH duplicates AS (
  SELECT 
    id,
    reference,
    ROW_NUMBER() OVER (PARTITION BY reference ORDER BY created_at, id) as rn
  FROM journal_entries
  WHERE reference LIKE 'POS-%'
    AND created_at >= '2025-11-03'
)
DELETE FROM journal_entries
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Drop the existing trigger
DROP TRIGGER IF EXISTS handle_pos_journal_entry_trigger ON pos_transactions;

-- Recreate the trigger to fire only AFTER INSERT (not UPDATE/DELETE)
-- This prevents duplicate entries when records are modified
CREATE TRIGGER handle_pos_journal_entry_trigger
  AFTER INSERT ON pos_transactions
  FOR EACH ROW
  EXECUTE FUNCTION handle_pos_journal_entry();