
-- Drop triggers if they exist
DROP TRIGGER IF EXISTS deduct_stock_trigger ON pos_transactions;
DROP TRIGGER IF EXISTS restore_stock_on_delete_trigger ON pos_transactions;

-- Create trigger for stock deduction on INSERT
CREATE TRIGGER deduct_stock_trigger
  AFTER INSERT ON pos_transactions
  FOR EACH ROW
  EXECUTE FUNCTION deduct_stock_simple();

-- Create trigger for stock restoration on DELETE
CREATE TRIGGER restore_stock_on_delete_trigger
  BEFORE DELETE ON pos_transactions
  FOR EACH ROW
  EXECUTE FUNCTION restore_stock_on_transaction_delete();
