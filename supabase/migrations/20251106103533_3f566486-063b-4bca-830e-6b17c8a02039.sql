
-- Final Stock Reconciliation: Use adjustment quantity_change as absolute stock value
-- Step 1: Reset ALL stocks to zero
UPDATE products SET stock_quantity = 0;
UPDATE product_variants SET stock_quantity = 0;

-- Step 2: Calculate stock from purchases minus sales for ALL items
-- Products without variants - calculate from all purchases and sales
UPDATE products p
SET stock_quantity = GREATEST(0, 
  COALESCE((
    SELECT SUM(pi.quantity)
    FROM purchase_items pi
    JOIN purchases pu ON pu.id = pi.purchase_id
    WHERE pi.product_id = p.id
      AND pi.variant_id IS NULL
  ), 0)
  -
  COALESCE((
    SELECT SUM((item->>'quantity')::numeric)
    FROM pos_transactions pt,
         jsonb_array_elements(pt.items) AS item
    WHERE (item->>'product_id')::uuid = p.id
      AND (item->>'variant_id') IS NULL
  ), 0)
);

-- Product variants - calculate from all purchases and sales
UPDATE product_variants pv
SET stock_quantity = GREATEST(0,
  COALESCE((
    SELECT SUM(pi.quantity)
    FROM purchase_items pi
    JOIN purchases pu ON pu.id = pi.purchase_id
    WHERE pi.variant_id = pv.id
  ), 0)
  -
  COALESCE((
    SELECT SUM((item->>'quantity')::numeric)
    FROM pos_transactions pt,
         jsonb_array_elements(pt.items) AS item
    WHERE (item->>'variant_id')::uuid = pv.id
  ), 0)
);

-- Step 3: Override with most recent adjustment quantity_change where adjustments exist
-- Products without variants with adjustments - replace with adjustment value
WITH latest_adjustments AS (
  SELECT DISTINCT ON (product_id)
    product_id,
    quantity_change
  FROM stock_adjustments
  WHERE variant_id IS NULL
  ORDER BY product_id, created_at DESC
)
UPDATE products p
SET stock_quantity = GREATEST(0, la.quantity_change)
FROM latest_adjustments la
WHERE la.product_id = p.id;

-- Product variants with adjustments - replace with adjustment value
WITH latest_adjustments AS (
  SELECT DISTINCT ON (variant_id)
    variant_id,
    quantity_change
  FROM stock_adjustments
  WHERE variant_id IS NOT NULL
  ORDER BY variant_id, created_at DESC
)
UPDATE product_variants pv
SET stock_quantity = GREATEST(0, la.quantity_change)
FROM latest_adjustments la
WHERE la.variant_id = pv.id;
