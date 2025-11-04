
-- Drop duplicate triggers on pos_transactions
-- Keep only one trigger for journal entry creation
DROP TRIGGER IF EXISTS create_pos_journal_entry_trigger ON pos_transactions;
DROP TRIGGER IF EXISTS pos_journal_entry_trigger ON pos_transactions;
-- Keep: handle_pos_journal_entry_trigger

-- Recreate the trigger properly with UPDATE and DELETE support
DROP TRIGGER IF EXISTS handle_pos_journal_entry_trigger ON pos_transactions;
CREATE TRIGGER handle_pos_journal_entry_trigger
  AFTER INSERT OR UPDATE OR DELETE ON pos_transactions
  FOR EACH ROW
  EXECUTE FUNCTION handle_pos_journal_entry();
