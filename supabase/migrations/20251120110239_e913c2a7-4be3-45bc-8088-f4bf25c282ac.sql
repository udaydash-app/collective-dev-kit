-- Revert JALANI PUDINA AAM PANNA 50GM stock back to 288 units
-- Update purchase items for PUR-1EC2C16BD7
UPDATE purchase_items
SET quantity = 288,
    total_cost = 288 * 375
WHERE purchase_id = (SELECT id FROM purchases WHERE purchase_number = 'PUR-1EC2C16BD7')
  AND product_id = (SELECT id FROM products WHERE name = 'JALANI PUDINA AAM PANNA 50GM');

-- Update inventory layers
UPDATE inventory_layers
SET quantity_purchased = 288,
    quantity_remaining = 288
WHERE purchase_id = (SELECT id FROM purchases WHERE purchase_number = 'PUR-1EC2C16BD7')
  AND product_id = (SELECT id FROM products WHERE name = 'JALANI PUDINA AAM PANNA 50GM');

-- Update product stock quantity
UPDATE products
SET stock_quantity = 288
WHERE name = 'JALANI PUDINA AAM PANNA 50GM';

-- Update purchase total amount
UPDATE purchases
SET total_amount = 36006348.08
WHERE purchase_number = 'PUR-1EC2C16BD7';