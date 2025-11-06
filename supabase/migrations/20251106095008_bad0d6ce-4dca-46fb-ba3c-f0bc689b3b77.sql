-- Complete Stock Reconciliation: All Time with Adjustment Override
-- Step 1: Reset ALL stocks to zero
UPDATE products SET stock_quantity = 0;
UPDATE product_variants SET stock_quantity = 0;

-- Step 2: Products WITHOUT adjustments - calculate from ALL purchases and sales
-- Products without variants and no adjustments
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
)
WHERE NOT EXISTS (
  SELECT 1 FROM stock_adjustments sa
  WHERE sa.product_id = p.id
    AND sa.variant_id IS NULL
);

-- Product variants without adjustments
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
)
WHERE NOT EXISTS (
  SELECT 1 FROM stock_adjustments sa
  WHERE sa.variant_id = pv.id
);

-- Step 3: Products WITH adjustments - calculate up to adjustment date, apply adjustment, then continue
-- Products without variants with adjustments
WITH latest_adjustments AS (
  SELECT DISTINCT ON (product_id)
    product_id,
    variant_id,
    created_at as adjustment_date,
    quantity_change
  FROM stock_adjustments
  WHERE variant_id IS NULL
  ORDER BY product_id, created_at DESC
)
UPDATE products p
SET stock_quantity = GREATEST(0,
  -- Stock at adjustment = (purchases before - sales before + adjustment change)
  (COALESCE((
    SELECT SUM(pi.quantity)
    FROM purchase_items pi
    JOIN purchases pu ON pu.id = pi.purchase_id
    WHERE pi.product_id = p.id
      AND pi.variant_id IS NULL
      AND pu.purchased_at < la.adjustment_date
  ), 0)
  -
  COALESCE((
    SELECT SUM((item->>'quantity')::numeric)
    FROM pos_transactions pt,
         jsonb_array_elements(pt.items) AS item
    WHERE (item->>'product_id')::uuid = p.id
      AND (item->>'variant_id') IS NULL
      AND pt.created_at < la.adjustment_date
  ), 0)
  + la.quantity_change)
  -- Plus purchases after adjustment
  +
  COALESCE((
    SELECT SUM(pi.quantity)
    FROM purchase_items pi
    JOIN purchases pu ON pu.id = pi.purchase_id
    WHERE pi.product_id = p.id
      AND pi.variant_id IS NULL
      AND pu.purchased_at >= la.adjustment_date
  ), 0)
  -- Minus sales after adjustment
  -
  COALESCE((
    SELECT SUM((item->>'quantity')::numeric)
    FROM pos_transactions pt,
         jsonb_array_elements(pt.items) AS item
    WHERE (item->>'product_id')::uuid = p.id
      AND (item->>'variant_id') IS NULL
      AND pt.created_at >= la.adjustment_date
  ), 0)
)
FROM latest_adjustments la
WHERE la.product_id = p.id;

-- Product variants with adjustments
WITH latest_adjustments AS (
  SELECT DISTINCT ON (variant_id)
    product_id,
    variant_id,
    created_at as adjustment_date,
    quantity_change
  FROM stock_adjustments
  WHERE variant_id IS NOT NULL
  ORDER BY variant_id, created_at DESC
)
UPDATE product_variants pv
SET stock_quantity = GREATEST(0,
  -- Stock at adjustment = (purchases before - sales before + adjustment change)
  (COALESCE((
    SELECT SUM(pi.quantity)
    FROM purchase_items pi
    JOIN purchases pu ON pu.id = pi.purchase_id
    WHERE pi.variant_id = pv.id
      AND pu.purchased_at < la.adjustment_date
  ), 0)
  -
  COALESCE((
    SELECT SUM((item->>'quantity')::numeric)
    FROM pos_transactions pt,
         jsonb_array_elements(pt.items) AS item
    WHERE (item->>'variant_id')::uuid = pv.id
      AND pt.created_at < la.adjustment_date
  ), 0)
  + la.quantity_change)
  -- Plus purchases after adjustment
  +
  COALESCE((
    SELECT SUM(pi.quantity)
    FROM purchase_items pi
    JOIN purchases pu ON pu.id = pi.purchase_id
    WHERE pi.variant_id = pv.id
      AND pu.purchased_at >= la.adjustment_date
  ), 0)
  -- Minus sales after adjustment
  -
  COALESCE((
    SELECT SUM((item->>'quantity')::numeric)
    FROM pos_transactions pt,
         jsonb_array_elements(pt.items) AS item
    WHERE (item->>'variant_id')::uuid = pv.id
      AND pt.created_at >= la.adjustment_date
  ), 0)
)
FROM latest_adjustments la
WHERE la.variant_id = pv.id;