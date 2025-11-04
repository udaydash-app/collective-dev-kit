-- Create trigger to update stock when purchase items are inserted
CREATE TRIGGER trigger_update_stock_on_purchase
AFTER INSERT ON purchase_items
FOR EACH ROW
EXECUTE FUNCTION update_stock_on_purchase();