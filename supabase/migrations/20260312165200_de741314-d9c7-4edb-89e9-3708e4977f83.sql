
-- Fix REG-CLOSE-DDDE7DEA (Mar 11, 2026)
-- Session ddde7dea: expected_cash=42500, closing_cash=96000, difference=53500
-- Correct logic: base entry uses expected_cash (42500), overage uses difference (53500)

-- Step 1: Delete all existing lines for this journal entry
DELETE FROM journal_entry_lines 
WHERE journal_entry_id = '94940ac8-95af-419f-b416-be24812ea8b4';

-- Step 2: Re-insert correct lines
-- Base: Debit 5711 (expected), Credit 571 (expected)
INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
VALUES 
  ('94940ac8-95af-419f-b416-be24812ea8b4', 'fac23dc4-c6e6-4b75-ae5d-589a8b1c125e', 
   'Cash collected from register (expected)', 42500, 0),
  ('94940ac8-95af-419f-b416-be24812ea8b4', '726bb393-7739-475e-9e84-99058b1ac8a8', 
   'Register closing cash (expected)', 0, 42500),
-- Overage: Debit 5711, Credit 7799
  ('94940ac8-95af-419f-b416-be24812ea8b4', 'fac23dc4-c6e6-4b75-ae5d-589a8b1c125e', 
   'Cash overage (53500)', 53500, 0),
  ('94940ac8-95af-419f-b416-be24812ea8b4', '6ab998dd-3a9c-4e88-b6c2-272670f72e81', 
   'Cash over - excess cash in register (53500)', 0, 53500);

-- Step 3: Update journal entry totals to reflect corrected amounts (96000 = 42500 + 53500)
UPDATE journal_entries 
SET total_debit = 96000, total_credit = 96000
WHERE id = '94940ac8-95af-419f-b416-be24812ea8b4';

-- Mar 10 (REG-CLOSE-91D45261) already matches new logic (expected=-123000 → fallback closing_cash=7500)
-- No change needed for Mar 10.
