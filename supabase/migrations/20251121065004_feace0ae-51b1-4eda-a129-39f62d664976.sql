-- Delete the ud test customer contact and account
-- First, remove the ledger account reference from the contact
UPDATE contacts
SET customer_ledger_account_id = NULL
WHERE id = '0aac5b61-124e-4d8f-87bc-26ec0bd4c611';

-- Then delete the contact
DELETE FROM contacts
WHERE id = '0aac5b61-124e-4d8f-87bc-26ec0bd4c611';

-- Finally, delete the customer ledger account
DELETE FROM accounts
WHERE id = '4f29229e-72d4-442e-995e-a77ca3d62106';