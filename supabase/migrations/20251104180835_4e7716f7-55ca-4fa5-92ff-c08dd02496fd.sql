
-- Recalculate stock quantities CORRECTLY by checking BOTH 'id' and 'productId' fields
-- Formula: current_stock = total_purchases - total_sales

CREATE TEMP TABLE stock_calculations_v2 AS
WITH purchase_totals AS (
  SELECT 
    product_id,
    COALESCE(SUM(quantity), 0) as total_purchased
  FROM purchase_items
  GROUP BY product_id
),
sales_totals AS (
  SELECT 
    COALESCE(
      (item->>'productId')::uuid,
      (item->>'id')::uuid
    ) as product_id,
    COALESCE(SUM((item->>'quantity')::integer), 0) as total_sold
  FROM pos_transactions pt,
  LATERAL jsonb_array_elements(pt.items) as item
  WHERE (item->>'productId') IS NOT NULL OR (item->>'id') IS NOT NULL
  GROUP BY COALESCE((item->>'productId')::uuid, (item->>'id')::uuid)
)
SELECT 
  p.id as product_id,
  p.name,
  p.stock_quantity as old_stock,
  COALESCE(pur.total_purchased, 0) as total_purchased,
  COALESCE(sal.total_sold, 0) as total_sold,
  COALESCE(pur.total_purchased, 0) - COALESCE(sal.total_sold, 0) as correct_stock,
  p.stock_quantity - (COALESCE(pur.total_purchased, 0) - COALESCE(sal.total_sold, 0)) as difference
FROM products p
LEFT JOIN purchase_totals pur ON pur.product_id = p.id
LEFT JOIN sales_totals sal ON sal.product_id = p.id;

-- Update all products with the correct stock quantity
UPDATE products p
SET 
  stock_quantity = sc.correct_stock,
  updated_at = NOW()
FROM stock_calculations_v2 sc
WHERE p.id = sc.product_id
AND p.stock_quantity != sc.correct_stock;

-- Log the recalculation results
DO $$
DECLARE
  total_updated INTEGER;
  negative_stock_count INTEGER;
  krushi_old INTEGER;
  krushi_new INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_updated 
  FROM stock_calculations_v2 
  WHERE old_stock != correct_stock;
  
  SELECT COUNT(*) INTO negative_stock_count 
  FROM stock_calculations_v2 
  WHERE correct_stock < 0;
  
  SELECT old_stock INTO krushi_old 
  FROM stock_calculations_v2 
  WHERE name LIKE '%KRUSHI CHAKKI ATTA%';
  
  SELECT correct_stock INTO krushi_new 
  FROM stock_calculations_v2 
  WHERE name LIKE '%KRUSHI CHAKKI ATTA%';
  
  RAISE NOTICE 'Stock recalculation completed:';
  RAISE NOTICE '  Products updated: %', total_updated;
  RAISE NOTICE '  Products with negative stock: %', negative_stock_count;
  RAISE NOTICE '  KRUSHI CHAKKI ATTA: % -> %', krushi_old, krushi_new;
END $$;
