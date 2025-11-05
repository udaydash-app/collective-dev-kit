
-- Delete the duplicate ROHIT RAMNANI contact (newer entry with typo)

-- Delete journal entry lines first (if any)
DELETE FROM journal_entry_lines
WHERE account_id IN (
  SELECT id FROM accounts WHERE account_code = '1030-738E471FA7'
);

-- Delete journal entries that are now empty
DELETE FROM journal_entries
WHERE NOT EXISTS (
  SELECT 1 FROM journal_entry_lines WHERE journal_entry_id = journal_entries.id
);

-- Delete the duplicate contact
DELETE FROM contacts
WHERE id = 'e578290d-bb16-44ac-862f-1cab077563be'; -- ROHIT RAMNANI KORHOGO (newer)

-- Delete the orphaned ledger account
DELETE FROM accounts
WHERE account_code = '1030-738E471FA7';
