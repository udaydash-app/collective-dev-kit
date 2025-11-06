-- Drop the old duplicate trigger
DROP TRIGGER IF EXISTS create_contact_ledgers ON contacts;

-- The correct trigger (create_contact_ledger_accounts_trigger) is already in place and handles both INSERT and UPDATE