-- Drop the correct POS accounting trigger
-- The trigger name is pos_transaction_accounting_trigger, not create_pos_journal_entry_trigger

DROP TRIGGER IF EXISTS pos_transaction_accounting_trigger ON pos_transactions;