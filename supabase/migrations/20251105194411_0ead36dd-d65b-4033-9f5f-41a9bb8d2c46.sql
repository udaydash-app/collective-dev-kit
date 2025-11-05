
-- Fix reconciliation to handle both 'id' and 'variantId' fields in POS items
-- The POS system inconsistently uses 'id' or 'variantId' to store the variant reference

-- Reset all product stocks with variants back to 0 first
UPDATE products p
SET stock_quantity = 0,
    updated_at = NOW()
WHERE EXISTS (
  SELECT 1 FROM product_variants pv WHERE pv.product_id = p.id
);

-- Reconcile variant stocks with corrected POS sales detection
WITH variant_calculations AS (
  SELECT 
    pv.id,
    -- Purchases
    COALESCE((
      SELECT SUM(pi.quantity) 
      FROM purchase_items pi 
      WHERE pi.variant_id = pv.id
    ), 0) +
    -- Stock Adjustments
    COALESCE((
      SELECT SUM(sa.quantity_change) 
      FROM stock_adjustments sa 
      WHERE sa.variant_id = pv.id
    ), 0) -
    -- Sales where variantId is explicitly set
    COALESCE((
      SELECT SUM((item->>'quantity')::numeric)
      FROM pos_transactions pt,
        jsonb_array_elements(pt.items) as item
      WHERE (item->>'variantId')::uuid = pv.id
    ), 0) -
    -- Sales where the 'id' field is the variant (common pattern)
    COALESCE((
      SELECT SUM((item->>'quantity')::numeric)
      FROM pos_transactions pt,
        jsonb_array_elements(pt.items) as item
      WHERE (item->>'id')::uuid = pv.id
        AND item->>'variantId' IS NULL
    ), 0) as calculated_stock
  FROM product_variants pv
)
UPDATE product_variants pv
SET stock_quantity = vc.calculated_stock,
    updated_at = NOW()
FROM variant_calculations vc
WHERE pv.id = vc.id;

-- Reconcile product stocks (only for products WITHOUT variants)
WITH product_calculations AS (
  SELECT 
    p.id,
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
        AND item->>'variantId' IS NULL
        AND item->>'id' NOT IN (
          SELECT id::text FROM product_variants WHERE product_id = p.id
        )
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
WHERE p.id = pc.id;
