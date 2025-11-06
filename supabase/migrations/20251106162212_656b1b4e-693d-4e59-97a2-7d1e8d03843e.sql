-- Clean up duplicate opening balance journal entries
-- Keep only the most recent entry for each contact's opening balance

-- Delete duplicate customer opening balance entries (keeping the latest one)
WITH customer_duplicates AS (
  SELECT 
    je.id,
    je.description,
    je.posted_at,
    jel.account_id,
    ROW_NUMBER() OVER (
      PARTITION BY jel.account_id 
      ORDER BY je.posted_at DESC, je.created_at DESC
    ) as rn
  FROM journal_entries je
  JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
  WHERE je.reference LIKE 'OB-CUST-%'
    AND je.description LIKE 'Opening Balance - %'
)
DELETE FROM journal_entries
WHERE id IN (
  SELECT id 
  FROM customer_duplicates 
  WHERE rn > 1
);

-- Delete duplicate supplier opening balance entries (keeping the latest one)
WITH supplier_duplicates AS (
  SELECT 
    je.id,
    je.description,
    je.posted_at,
    jel.account_id,
    ROW_NUMBER() OVER (
      PARTITION BY jel.account_id 
      ORDER BY je.posted_at DESC, je.created_at DESC
    ) as rn
  FROM journal_entries je
  JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
  WHERE je.reference LIKE 'OB-SUPP-%'
    AND je.description LIKE 'Opening Balance - %'
)
DELETE FROM journal_entries
WHERE id IN (
  SELECT id 
  FROM supplier_duplicates 
  WHERE rn > 1
);