-- Update the purchase accounting trigger to handle INSERT, UPDATE, and DELETE operations
DROP TRIGGER IF EXISTS purchase_accounting_trigger ON purchases;

CREATE TRIGGER purchase_accounting_trigger
  AFTER INSERT OR UPDATE OR DELETE ON purchases
  FOR EACH ROW
  EXECUTE FUNCTION create_purchase_journal_entry();