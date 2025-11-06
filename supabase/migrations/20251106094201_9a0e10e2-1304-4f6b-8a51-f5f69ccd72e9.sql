-- Stock Reconciliation: Only Update Products with Activity Since 2025-11-01
-- Step 1: Reset ONLY products/variants with activity (purchases, sales, or adjustments) since 2025-11-01
-- Reset products with activity
UPDATE products p
SET stock_quantity = 0
WHERE EXISTS (
  SELECT 1 FROM purchase_items pi
  JOIN purchases pu ON pu.id = pi.purchase_id
  WHERE pi.product_id = p.id AND pu.purchased_at >= '2025-11-01'
) OR EXISTS (
  SELECT 1 FROM pos_transactions pt, jsonb_array_elements(pt.items) AS item
  WHERE (item->>'product_id')::uuid = p.id AND pt.created_at >= '2025-11-01'
) OR EXISTS (
  SELECT 1 FROM stock_adjustments sa
  WHERE sa.product_id = p.id AND sa.created_at >= '2025-11-01'
);

-- Reset variants with activity
UPDATE product_variants pv
SET stock_quantity = 0
WHERE EXISTS (
  SELECT 1 FROM purchase_items pi
  JOIN purchases pu ON pu.id = pi.purchase_id
  WHERE pi.variant_id = pv.id AND pu.purchased_at >= '2025-11-01'
) OR EXISTS (
  SELECT 1 FROM pos_transactions pt, jsonb_array_elements(pt.items) AS item
  WHERE (item->>'variant_id')::uuid = pv.id AND pt.created_at >= '2025-11-01'
) OR EXISTS (
  SELECT 1 FROM stock_adjustments sa
  WHERE sa.variant_id = pv.id AND sa.created_at >= '2025-11-01'
);

-- Step 2: Products WITHOUT adjustments - calculate from purchases and sales
UPDATE products p
SET stock_quantity = GREATEST(0, 
  COALESCE((
    SELECT SUM(pi.quantity)
    FROM purchase_items pi
    JOIN purchases pu ON pu.id = pi.purchase_id
    WHERE pi.product_id = p.id
      AND pi.variant_id IS NULL
      AND pu.purchased_at >= '2025-11-01'
  ), 0)
  -
  COALESCE((
    SELECT SUM((item->>'quantity')::numeric)
    FROM pos_transactions pt,
         jsonb_array_elements(pt.items) AS item
    WHERE (item->>'product_id')::uuid = p.id
      AND (item->>'variant_id') IS NULL
      AND pt.created_at >= '2025-11-01'
  ), 0)
)
WHERE NOT EXISTS (
  SELECT 1 FROM stock_adjustments sa
  WHERE sa.product_id = p.id
    AND sa.variant_id IS NULL
    AND sa.created_at >= '2025-11-01'
)
AND (
  EXISTS (
    SELECT 1 FROM purchase_items pi
    JOIN purchases pu ON pu.id = pi.purchase_id
    WHERE pi.product_id = p.id AND pi.variant_id IS NULL AND pu.purchased_at >= '2025-11-01'
  ) OR EXISTS (
    SELECT 1 FROM pos_transactions pt, jsonb_array_elements(pt.items) AS item
    WHERE (item->>'product_id')::uuid = p.id AND (item->>'variant_id') IS NULL AND pt.created_at >= '2025-11-01'
  )
);

-- Variants without adjustments
UPDATE product_variants pv
SET stock_quantity = GREATEST(0,
  COALESCE((
    SELECT SUM(pi.quantity)
    FROM purchase_items pi
    JOIN purchases pu ON pu.id = pi.purchase_id
    WHERE pi.variant_id = pv.id
      AND pu.purchased_at >= '2025-11-01'
  ), 0)
  -
  COALESCE((
    SELECT SUM((item->>'quantity')::numeric)
    FROM pos_transactions pt,
         jsonb_array_elements(pt.items) AS item
    WHERE (item->>'variant_id')::uuid = pv.id
      AND pt.created_at >= '2025-11-01'
  ), 0)
)
WHERE NOT EXISTS (
  SELECT 1 FROM stock_adjustments sa
  WHERE sa.variant_id = pv.id
    AND sa.created_at >= '2025-11-01'
)
AND (
  EXISTS (
    SELECT 1 FROM purchase_items pi
    JOIN purchases pu ON pu.id = pi.purchase_id
    WHERE pi.variant_id = pv.id AND pu.purchased_at >= '2025-11-01'
  ) OR EXISTS (
    SELECT 1 FROM pos_transactions pt, jsonb_array_elements(pt.items) AS item
    WHERE (item->>'variant_id')::uuid = pv.id AND pt.created_at >= '2025-11-01'
  )
);

-- Step 3: Products WITH adjustments - adjustment overrides calculated value
-- Get stock at adjustment time, apply adjustment, then continue from there
WITH latest_adjustments AS (
  SELECT DISTINCT ON (product_id)
    product_id,
    variant_id,
    created_at as adjustment_date,
    quantity_change
  FROM stock_adjustments
  WHERE created_at >= '2025-11-01'
    AND variant_id IS NULL
  ORDER BY product_id, created_at DESC
)
UPDATE products p
SET stock_quantity = GREATEST(0,
  (COALESCE((
    SELECT SUM(pi.quantity)
    FROM purchase_items pi
    JOIN purchases pu ON pu.id = pi.purchase_id
    WHERE pi.product_id = p.id
      AND pi.variant_id IS NULL
      AND pu.purchased_at >= '2025-11-01'
      AND pu.purchased_at < la.adjustment_date
  ), 0)
  -
  COALESCE((
    SELECT SUM((item->>'quantity')::numeric)
    FROM pos_transactions pt,
         jsonb_array_elements(pt.items) AS item
    WHERE (item->>'product_id')::uuid = p.id
      AND (item->>'variant_id') IS NULL
      AND pt.created_at >= '2025-11-01'
      AND pt.created_at < la.adjustment_date
  ), 0)
  + la.quantity_change)
  +
  COALESCE((
    SELECT SUM(pi.quantity)
    FROM purchase_items pi
    JOIN purchases pu ON pu.id = pi.purchase_id
    WHERE pi.product_id = p.id
      AND pi.variant_id IS NULL
      AND pu.purchased_at >= la.adjustment_date
  ), 0)
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

-- Variants with adjustments
WITH latest_adjustments AS (
  SELECT DISTINCT ON (variant_id)
    product_id,
    variant_id,
    created_at as adjustment_date,
    quantity_change
  FROM stock_adjustments
  WHERE created_at >= '2025-11-01'
    AND variant_id IS NOT NULL
  ORDER BY variant_id, created_at DESC
)
UPDATE product_variants pv
SET stock_quantity = GREATEST(0,
  (COALESCE((
    SELECT SUM(pi.quantity)
    FROM purchase_items pi
    JOIN purchases pu ON pu.id = pi.purchase_id
    WHERE pi.variant_id = pv.id
      AND pu.purchased_at >= '2025-11-01'
      AND pu.purchased_at < la.adjustment_date
  ), 0)
  -
  COALESCE((
    SELECT SUM((item->>'quantity')::numeric)
    FROM pos_transactions pt,
         jsonb_array_elements(pt.items) AS item
    WHERE (item->>'variant_id')::uuid = pv.id
      AND pt.created_at >= '2025-11-01'
      AND pt.created_at < la.adjustment_date
  ), 0)
  + la.quantity_change)
  +
  COALESCE((
    SELECT SUM(pi.quantity)
    FROM purchase_items pi
    JOIN purchases pu ON pu.id = pi.purchase_id
    WHERE pi.variant_id = pv.id
      AND pu.purchased_at >= la.adjustment_date
  ), 0)
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