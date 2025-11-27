
-- Drop all duplicate triggers, keeping only the correctly named ones
DROP TRIGGER IF EXISTS trigger_deduct_stock_simple ON pos_transactions;
DROP TRIGGER IF EXISTS restore_stock_on_pos_transaction_delete ON pos_transactions;
DROP TRIGGER IF EXISTS pos_journal_entry_trigger ON pos_transactions;
DROP TRIGGER IF EXISTS pos_transaction_journal_entry ON pos_transactions;

-- Verify we have the correct triggers:
-- deduct_stock_trigger (INSERT)
-- restore_stock_on_delete_trigger (DELETE)
-- handle_pos_journal_entry_trigger (INSERT/UPDATE/DELETE)
