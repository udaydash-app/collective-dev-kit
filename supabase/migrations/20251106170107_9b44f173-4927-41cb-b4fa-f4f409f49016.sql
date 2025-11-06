-- Update journal entry JE-386AC5D37F to match current payment receipt
UPDATE journal_entries
SET 
  entry_date = '2025-11-06',
  description = 'Payment Receipt - PMT-D42517C6EE',
  total_debit = 517100,
  total_credit = 517100,
  updated_at = now()
WHERE entry_number = 'JE-386AC5D37F';

-- Delete old journal entry lines
DELETE FROM journal_entry_lines 
WHERE journal_entry_id = (SELECT id FROM journal_entries WHERE entry_number = 'JE-386AC5D37F');

-- Insert correct journal entry lines
-- Debit Mobile Money account (payment received)
INSERT INTO journal_entry_lines (
  journal_entry_id, 
  account_id, 
  debit_amount, 
  credit_amount, 
  description
)
VALUES (
  (SELECT id FROM journal_entries WHERE entry_number = 'JE-386AC5D37F'),
  (SELECT id FROM accounts WHERE account_name = 'Mobile Money' LIMIT 1),
  517100,
  0,
  'Payment method: mobile_money'
);

-- Credit Customer ledger account (reduces receivable)
INSERT INTO journal_entry_lines (
  journal_entry_id, 
  account_id, 
  debit_amount, 
  credit_amount, 
  description
)
VALUES (
  (SELECT id FROM journal_entries WHERE entry_number = 'JE-386AC5D37F'),
  '68cdddd4-e7cc-4fde-94af-47aac7b55677'::uuid, -- INDIAN BAZAAR customer ledger account
  0,
  517100,
  'Payment from customer'
);