
-- Drop all existing triggers on pos_transactions that create journal entries
DROP TRIGGER IF EXISTS create_pos_journal_entry ON pos_transactions CASCADE;
DROP TRIGGER IF EXISTS handle_pos_journal_entry ON pos_transactions CASCADE;
DROP TRIGGER IF EXISTS pos_transaction_journal_entry ON pos_transactions CASCADE;
DROP TRIGGER IF EXISTS create_pos_journal_entry_trigger ON pos_transactions CASCADE;

-- Drop the old function
DROP FUNCTION IF EXISTS create_pos_journal_entry() CASCADE;

-- Create single trigger using the handle_pos_journal_entry function
CREATE TRIGGER create_pos_journal_entry_trigger
  AFTER INSERT OR UPDATE OR DELETE ON pos_transactions
  FOR EACH ROW
  EXECUTE FUNCTION handle_pos_journal_entry();
