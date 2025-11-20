-- DATA CORRECTION: Revert JALANI PUDINA AAM PANNA 50GM back to 48 units

-- Update the purchase item quantity
UPDATE purchase_items
SET quantity = 48,
    total_cost = 48 * unit_cost
WHERE id = '69ce0c84-647d-43a3-a101-7db1cf5145d4'
  AND product_id = '79520cb7-469e-46b6-ad47-a9964cb2d1aa';

-- Update the inventory layer
UPDATE inventory_layers
SET quantity_purchased = 48,
    quantity_remaining = 48,
    updated_at = NOW()
WHERE product_id = '79520cb7-469e-46b6-ad47-a9964cb2d1aa'
  AND purchase_id = 'f06aa5a2-3037-415f-af93-aab9a5052963';

-- Update the product stock
UPDATE products
SET stock_quantity = 48,
    updated_at = NOW()
WHERE id = '79520cb7-469e-46b6-ad47-a9964cb2d1aa';

-- Update the purchase total amount
UPDATE purchases
SET total_amount = (
  SELECT COALESCE(SUM(total_cost), 0)
  FROM purchase_items
  WHERE purchase_id = 'f06aa5a2-3037-415f-af93-aab9a5052963'
),
updated_at = NOW()
WHERE id = 'f06aa5a2-3037-415f-af93-aab9a5052963';