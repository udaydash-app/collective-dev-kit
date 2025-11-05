-- Delete duplicate POS journal entries, keeping only the oldest one for each reference
WITH duplicates AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY reference, description, entry_date, total_debit, total_credit 
      ORDER BY created_at ASC
    ) as rn
  FROM journal_entries
  WHERE reference LIKE 'POS-%'
)
DELETE FROM journal_entries
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Also check for duplicate opening balance entries for the same contact
WITH opening_balance_duplicates AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY description 
      ORDER BY created_at ASC
    ) as rn
  FROM journal_entries
  WHERE description LIKE 'Opening Balance -%'
)
DELETE FROM journal_entries
WHERE id IN (
  SELECT id FROM opening_balance_duplicates WHERE rn > 1
);