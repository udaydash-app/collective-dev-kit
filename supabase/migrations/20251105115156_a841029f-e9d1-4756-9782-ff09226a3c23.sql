
-- Delete duplicate contacts and all associated data completely

-- Step 1: Delete all journal entry lines for these accounts
DELETE FROM journal_entry_lines
WHERE account_id IN (
  SELECT id FROM accounts WHERE account_code IN (
    '1030-B02899D4E0',  -- KAMLESH FOODIES duplicate
    '1030-C0C91DF451',  -- SUNIL SHIKHAR duplicate
    '1030-B7B5B16A03'   -- TUSHAR SEL ROYAL duplicate
  )
);

-- Step 2: Delete journal entries that are now empty
DELETE FROM journal_entries
WHERE NOT EXISTS (
  SELECT 1 FROM journal_entry_lines WHERE journal_entry_id = journal_entries.id
);

-- Step 3: Delete the duplicate contacts
DELETE FROM contacts
WHERE id IN (
  '2c222ab2-a3ee-45ae-a652-671b4c0c4caa',  -- KAMLESH FOODIES
  'c24600be-b3eb-4cf1-9aa8-952ee6f1ea84',  -- SUNIL SHIKHAR
  '3aa48f64-1915-4bb1-b4a1-2f4d7280297d'   -- TUSHAR SEL ROYAL
);

-- Step 4: Delete the orphaned ledger accounts
DELETE FROM accounts
WHERE account_code IN (
  '1030-B02899D4E0',
  '1030-C0C91DF451',
  '1030-B7B5B16A03'
);
