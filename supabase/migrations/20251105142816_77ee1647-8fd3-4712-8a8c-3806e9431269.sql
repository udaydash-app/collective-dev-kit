
-- Delete the old journal entry for the Sudha transaction
-- The trigger will recreate it with the new logic when we update the transaction
DELETE FROM journal_entries 
WHERE reference = 'POS-8641244619';

-- Update the transaction to trigger the new journal entry creation
UPDATE pos_transactions 
SET updated_at = NOW()
WHERE transaction_number = 'POS-8641244619';
