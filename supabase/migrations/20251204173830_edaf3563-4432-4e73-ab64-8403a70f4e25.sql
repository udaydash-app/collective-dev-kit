-- Drop duplicate trigger on payment_receipts that causes duplicate journal entries
DROP TRIGGER IF EXISTS post_payment_receipt ON payment_receipts;

-- Clean up duplicate journal entries for payment receipts (keep the first one by entry_number)
DELETE FROM journal_entry_lines 
WHERE journal_entry_id IN (
  SELECT je.id 
  FROM journal_entries je
  INNER JOIN (
    SELECT reference, MIN(entry_number) as keep_entry
    FROM journal_entries
    WHERE reference LIKE 'PMT-%'
    GROUP BY reference
    HAVING COUNT(*) > 1
  ) dups ON je.reference = dups.reference AND je.entry_number != dups.keep_entry
);

DELETE FROM journal_entries 
WHERE id IN (
  SELECT je.id 
  FROM journal_entries je
  INNER JOIN (
    SELECT reference, MIN(entry_number) as keep_entry
    FROM journal_entries
    WHERE reference LIKE 'PMT-%'
    GROUP BY reference
    HAVING COUNT(*) > 1
  ) dups ON je.reference = dups.reference AND je.entry_number != dups.keep_entry
);