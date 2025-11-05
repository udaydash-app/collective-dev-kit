
-- Fix stock reconciliation for products with variants
-- When a product has variants, the product-level stock should be 0
-- and all stock should be on the variants

-- Step 1: Identify products that have variants and reset their stock to 0
UPDATE products p
SET stock_quantity = 0,
    updated_at = NOW()
WHERE EXISTS (
  SELECT 1 
  FROM product_variants pv 
  WHERE pv.product_id = p.id
)
AND p.stock_quantity != 0;

-- Step 2: Re-reconcile ALL variant stocks properly
WITH variant_calculations AS (
  SELECT 
    pv.id,
    pv.product_id,
    -- Purchases for this variant
    COALESCE((
      SELECT SUM(pi.quantity) 
      FROM purchase_items pi 
      WHERE pi.variant_id = pv.id
    ), 0) +
    -- Stock Adjustments for this variant
    COALESCE((
      SELECT SUM(sa.quantity_change) 
      FROM stock_adjustments sa 
      WHERE sa.variant_id = pv.id
    ), 0) -
    -- Sales from POS for this variant
    COALESCE((
      SELECT SUM((item->>'quantity')::numeric)
      FROM pos_transactions pt,
        jsonb_array_elements(pt.items) as item
      WHERE (item->>'variantId')::uuid = pv.id
    ), 0) -
    -- Also subtract sales that were mistakenly recorded at product level
    -- but should have been at variant level (when there's only one variant)
    COALESCE((
      SELECT SUM((item->>'quantity')::numeric)
      FROM pos_transactions pt,
        jsonb_array_elements(pt.items) as item
      WHERE (item->>'productId')::uuid = pv.product_id
        AND (item->>'variantId' IS NULL OR item->>'variantId' = 'null')
        AND NOT EXISTS (
          SELECT 1 FROM product_variants pv2 
          WHERE pv2.product_id = pv.product_id 
          AND pv2.id != pv.id
        )
    ), 0) as calculated_stock
  FROM product_variants pv
)
UPDATE product_variants pv
SET stock_quantity = vc.calculated_stock,
    updated_at = NOW()
FROM variant_calculations vc
WHERE pv.id = vc.id
  AND pv.stock_quantity != vc.calculated_stock;

-- Step 3: For products WITHOUT variants, recalculate their stock
WITH product_calculations AS (
  SELECT 
    p.id,
    -- Only calculate for products that have NO variants
    COALESCE((
      SELECT SUM(pi.quantity) 
      FROM purchase_items pi 
      WHERE pi.product_id = p.id 
        AND pi.variant_id IS NULL
    ), 0) +
    COALESCE((
      SELECT SUM(sa.quantity_change) 
      FROM stock_adjustments sa 
      WHERE sa.product_id = p.id 
        AND sa.variant_id IS NULL
    ), 0) -
    COALESCE((
      SELECT SUM((item->>'quantity')::numeric)
      FROM pos_transactions pt,
        jsonb_array_elements(pt.items) as item
      WHERE (item->>'productId')::uuid = p.id
        AND (item->>'variantId' IS NULL OR item->>'variantId' = 'null')
    ), 0) as calculated_stock
  FROM products p
  WHERE NOT EXISTS (
    SELECT 1 FROM product_variants pv WHERE pv.product_id = p.id
  )
)
UPDATE products p
SET stock_quantity = pc.calculated_stock,
    updated_at = NOW()
FROM product_calculations pc
WHERE p.id = pc.id
  AND p.stock_quantity != pc.calculated_stock;
