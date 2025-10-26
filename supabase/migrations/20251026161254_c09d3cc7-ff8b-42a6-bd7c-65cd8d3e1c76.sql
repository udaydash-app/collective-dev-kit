-- Disable the automatic journal entry creation for POS transactions
-- This trigger requires specific accounts to be set up in the chart of accounts
-- Drop the trigger to allow POS transactions without accounting integration

DROP TRIGGER IF EXISTS create_pos_journal_entry_trigger ON pos_transactions;