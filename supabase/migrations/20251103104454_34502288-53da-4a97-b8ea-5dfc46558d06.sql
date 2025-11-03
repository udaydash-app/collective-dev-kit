-- Create trigger for POS transactions to automatically create journal entries
DROP TRIGGER IF EXISTS create_pos_journal_entry_trigger ON pos_transactions;

CREATE TRIGGER create_pos_journal_entry_trigger
AFTER INSERT ON pos_transactions
FOR EACH ROW
EXECUTE FUNCTION create_pos_journal_entry();