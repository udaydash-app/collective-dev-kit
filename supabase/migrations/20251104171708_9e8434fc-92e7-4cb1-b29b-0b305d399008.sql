-- Step 1: Reset all product stock to 0
UPDATE products SET stock_quantity = 0;

-- Step 2: Add stock from purchases made today
WITH today_purchases AS (
  SELECT 
    pi.product_id,
    SUM(pi.quantity) as total_purchased
  FROM purchases p
  JOIN purchase_items pi ON p.id = pi.purchase_id
  WHERE DATE(p.purchased_at) = CURRENT_DATE
  GROUP BY pi.product_id
)
UPDATE products p
SET stock_quantity = p.stock_quantity + tp.total_purchased
FROM today_purchases tp
WHERE p.id = tp.product_id;

-- Step 3: Subtract all sales from Nov 3, 2025 onwards
WITH sales_items AS (
  SELECT 
    pt.id as transaction_id,
    (item->>'productId')::uuid as product_id,
    (item->>'quantity')::integer as quantity
  FROM pos_transactions pt
  CROSS JOIN LATERAL jsonb_array_elements(pt.items) as item
  WHERE pt.created_at >= '2025-11-03 00:00:00+00'
),
sales_aggregated AS (
  SELECT 
    product_id,
    SUM(quantity) as total_sold
  FROM sales_items
  GROUP BY product_id
)
UPDATE products p
SET stock_quantity = p.stock_quantity - COALESCE(sa.total_sold, 0)
FROM sales_aggregated sa
WHERE p.id = sa.product_id;