-- Remove check constraints that prevent negative stock
-- (Negative stock is useful to identify stock deficits)
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_stock_quantity_check;
ALTER TABLE product_variants DROP CONSTRAINT IF EXISTS product_variants_stock_quantity_check;

-- Comprehensive Stock Reconciliation
-- This will recalculate stock for all products based on actual transactions

-- Reconcile product stock (no variants)
WITH product_calculations AS (
  SELECT 
    p.id,
    -- Purchases
    COALESCE((
      SELECT SUM(pi.quantity) 
      FROM purchase_items pi 
      WHERE pi.product_id = p.id 
        AND pi.variant_id IS NULL
    ), 0) +
    -- Stock Adjustments
    COALESCE((
      SELECT SUM(sa.quantity_change) 
      FROM stock_adjustments sa 
      WHERE sa.product_id = p.id 
        AND sa.variant_id IS NULL
    ), 0) -
    -- Sales from POS
    COALESCE((
      SELECT SUM((item->>'quantity')::numeric)
      FROM pos_transactions pt,
        jsonb_array_elements(pt.items) as item
      WHERE (item->>'productId')::uuid = p.id
        AND item->>'variantId' IS NULL
    ), 0) as calculated_stock
  FROM products p
)
UPDATE products p
SET stock_quantity = pc.calculated_stock,
    updated_at = NOW()
FROM product_calculations pc
WHERE p.id = pc.id
  AND p.stock_quantity != pc.calculated_stock;

-- Reconcile variant stock
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
    -- Sales from POS
    COALESCE((
      SELECT SUM((item->>'quantity')::numeric)
      FROM pos_transactions pt,
        jsonb_array_elements(pt.items) as item
      WHERE (item->>'variantId')::uuid = pv.id
    ), 0) as calculated_stock
  FROM product_variants pv
)
UPDATE product_variants pv
SET stock_quantity = vc.calculated_stock,
    updated_at = NOW()
FROM variant_calculations vc
WHERE pv.id = vc.id
  AND pv.stock_quantity != vc.calculated_stock;