-- Fix existing journal entries: move timbre tax from 4431 (TVA) to 4471 (Droit de timbre)
-- Update journal entry lines where the transaction has timbre_tax in metadata

WITH timbre_account AS (
  SELECT id FROM accounts WHERE account_code = '4471' LIMIT 1
),
entries_to_fix AS (
  SELECT jel.id
  FROM journal_entry_lines jel
  JOIN journal_entries je ON jel.journal_entry_id = je.id
  JOIN accounts a ON jel.account_id = a.id
  JOIN pos_transactions pt ON je.reference = pt.transaction_number
  WHERE a.account_code = '4431'
    AND pt.metadata->>'timbre_tax' IS NOT NULL 
    AND (pt.metadata->>'timbre_tax')::numeric > 0
    AND jel.credit_amount = (pt.metadata->>'timbre_tax')::numeric
)
UPDATE journal_entry_lines
SET account_id = (SELECT id FROM timbre_account),
    description = 'Droit de timbre'
WHERE id IN (SELECT id FROM entries_to_fix);