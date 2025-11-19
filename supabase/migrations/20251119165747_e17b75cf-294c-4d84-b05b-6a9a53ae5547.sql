-- Ensure the reverse_stock_on_purchase_delete trigger is properly attached
-- This trigger should subtract stock when purchase items are deleted

-- First, drop the trigger if it exists to recreate it properly
DROP TRIGGER IF EXISTS reverse_stock_on_purchase_delete_trigger ON purchase_items;

-- Recreate the trigger on purchase_items table
CREATE TRIGGER reverse_stock_on_purchase_delete_trigger
  AFTER DELETE ON purchase_items
  FOR EACH ROW
  EXECUTE FUNCTION reverse_stock_on_purchase_delete();