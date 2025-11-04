
-- Recalculate stock quantities for all products based on purchases and sales
-- Formula: current_stock = total_purchases - total_sales

-- First, create a temporary table to hold the calculations
CREATE TEMP TABLE stock_calculations AS
WITH purchase_totals AS (
  SELECT 
    product_id,
    COALESCE(SUM(quantity), 0) as total_purchased
  FROM purchase_items
  GROUP BY product_id
),
sales_totals AS (
  SELECT 
    (item->>'productId')::uuid as product_id,
    COALESCE(SUM((item->>'quantity')::integer), 0) as total_sold
  FROM pos_transactions pt,
  LATERAL jsonb_array_elements(pt.items) as item
  WHERE item->>'productId' IS NOT NULL
  GROUP BY (item->>'productId')::uuid
)
SELECT 
  p.id as product_id,
  COALESCE(pur.total_purchased, 0) as total_purchased,
  COALESCE(sal.total_sold, 0) as total_sold,
  COALESCE(pur.total_purchased, 0) - COALESCE(sal.total_sold, 0) as correct_stock
FROM products p
LEFT JOIN purchase_totals pur ON pur.product_id = p.id
LEFT JOIN sales_totals sal ON sal.product_id = p.id;

-- Update all products with the correct stock quantity
UPDATE products p
SET 
  stock_quantity = sc.correct_stock,
  updated_at = NOW()
FROM stock_calculations sc
WHERE p.id = sc.product_id;

-- Log the recalculation results
DO $$
DECLARE
  total_updated INTEGER;
  negative_stock_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_updated FROM stock_calculations;
  SELECT COUNT(*) INTO negative_stock_count FROM stock_calculations WHERE correct_stock < 0;
  
  RAISE NOTICE 'Stock recalculation completed:';
  RAISE NOTICE '  Total products updated: %', total_updated;
  RAISE NOTICE '  Products with negative stock: %', negative_stock_count;
END $$;
