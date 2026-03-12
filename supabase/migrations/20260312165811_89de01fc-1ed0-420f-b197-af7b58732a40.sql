
-- Fix historical closing entries for Mar 10 and Mar 11 to match new clean structure:
-- REG-CLOSE = only physical cash transfer (actual closing cash)
-- REG-OVER  = separate entry for difference only (if any)

-- ══════════════════════════════════════════════════
-- MAR 10: Session 91d45261 (closing_cash=7500, difference=130500)
-- ══════════════════════════════════════════════════

-- 1a. Fix REG-CLOSE-91D45261: keep only physical transfer lines
DELETE FROM journal_entry_lines WHERE journal_entry_id = '0d519bc2-cf1f-46b4-bf3e-83fd1e7f242a';
INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount) VALUES
  ('0d519bc2-cf1f-46b4-bf3e-83fd1e7f242a', 'fac23dc4-c6e6-4b75-ae5d-589a8b1c125e', 'Cash collected from register', 7500, 0),
  ('0d519bc2-cf1f-46b4-bf3e-83fd1e7f242a', '726bb393-7739-475e-9e84-99058b1ac8a8', 'Register closing cash', 0, 7500);
UPDATE journal_entries SET total_debit = 7500, total_credit = 7500,
  description = 'Cash Register Closing - Session 91d45261-62e4-4fbd-b06f-c62905df89e2'
WHERE id = '0d519bc2-cf1f-46b4-bf3e-83fd1e7f242a';

-- 1b. Create separate REG-OVER-91D45261 for the 130500 overage
INSERT INTO journal_entries (id, description, entry_date, reference, total_debit, total_credit, status, created_by, posted_by, posted_at)
VALUES (
  gen_random_uuid(),
  'Cash Overage - Session 91d45261-62e4-4fbd-b06f-c62905df89e2 (+130500)',
  '2026-03-10',
  'REG-OVER-91D45261',
  130500, 130500,
  'posted',
  (SELECT cashier_id FROM cash_sessions WHERE id = '91d45261-62e4-4fbd-b06f-c62905df89e2'),
  (SELECT cashier_id FROM cash_sessions WHERE id = '91d45261-62e4-4fbd-b06f-c62905df89e2'),
  '2026-03-10 20:00:35.069+00'
);
INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
SELECT id, 'fac23dc4-c6e6-4b75-ae5d-589a8b1c125e', 'Cash overage (130500)', 130500, 0
FROM journal_entries WHERE reference = 'REG-OVER-91D45261';
INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
SELECT id, '6ab998dd-3a9c-4e88-b6c2-272670f72e81', 'Cash over - excess cash in register', 0, 130500
FROM journal_entries WHERE reference = 'REG-OVER-91D45261';

-- ══════════════════════════════════════════════════
-- MAR 11: Session ddde7dea (closing_cash=96000, difference=53500)
-- ══════════════════════════════════════════════════

-- 2a. Fix REG-CLOSE-DDDE7DEA: keep only physical transfer (actual closing_cash=96000)
DELETE FROM journal_entry_lines WHERE journal_entry_id = '94940ac8-95af-419f-b416-be24812ea8b4';
INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount) VALUES
  ('94940ac8-95af-419f-b416-be24812ea8b4', 'fac23dc4-c6e6-4b75-ae5d-589a8b1c125e', 'Cash collected from register', 96000, 0),
  ('94940ac8-95af-419f-b416-be24812ea8b4', '726bb393-7739-475e-9e84-99058b1ac8a8', 'Register closing cash', 0, 96000);
UPDATE journal_entries SET total_debit = 96000, total_credit = 96000,
  description = 'Cash Register Closing - Session ddde7dea-5628-495e-bd14-48ebfc84686b'
WHERE id = '94940ac8-95af-419f-b416-be24812ea8b4';

-- 2b. Create separate REG-OVER-DDDE7DEA for the 53500 overage
INSERT INTO journal_entries (id, description, entry_date, reference, total_debit, total_credit, status, created_by, posted_by, posted_at)
VALUES (
  gen_random_uuid(),
  'Cash Overage - Session ddde7dea-5628-495e-bd14-48ebfc84686b (+53500)',
  '2026-03-11',
  'REG-OVER-DDDE7DEA',
  53500, 53500,
  'posted',
  (SELECT cashier_id FROM cash_sessions WHERE id = 'ddde7dea-5628-495e-bd14-48ebfc84686b'),
  (SELECT cashier_id FROM cash_sessions WHERE id = 'ddde7dea-5628-495e-bd14-48ebfc84686b'),
  '2026-03-11 19:45:10.854+00'
);
INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
SELECT id, 'fac23dc4-c6e6-4b75-ae5d-589a8b1c125e', 'Cash overage (53500)', 53500, 0
FROM journal_entries WHERE reference = 'REG-OVER-DDDE7DEA';
INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
SELECT id, '6ab998dd-3a9c-4e88-b6c2-272670f72e81', 'Cash over - excess cash in register', 0, 53500
FROM journal_entries WHERE reference = 'REG-OVER-DDDE7DEA';
