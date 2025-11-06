
-- Clear all stock adjustments (they contain old delta values)
DELETE FROM stock_adjustments;

-- Reset all stock to zero
UPDATE products SET stock_quantity = 0;
UPDATE product_variants SET stock_quantity = 0;

-- Recalculate product stock: purchases - sales
UPDATE products p
SET stock_quantity = (
  -- Purchases for this product (no variant)
  SELECT COALESCE(SUM(pi.quantity), 0)
  FROM purchase_items pi
  WHERE pi.product_id = p.id
    AND pi.variant_id IS NULL
) - (
  -- POS sales for this product (no variant)
  SELECT COALESCE(SUM((item->>'quantity')::numeric), 0)
  FROM pos_transactions pt,
       jsonb_array_elements(pt.items) AS item
  WHERE (item->>'productId')::uuid = p.id
    AND item->>'variantId' IS NULL
);

-- Recalculate variant stock: purchases - sales
UPDATE product_variants pv
SET stock_quantity = (
  -- Purchases for this variant
  SELECT COALESCE(SUM(pi.quantity), 0)
  FROM purchase_items pi
  WHERE pi.variant_id = pv.id
) - (
  -- POS sales for this variant
  SELECT COALESCE(SUM((item->>'quantity')::numeric), 0)
  FROM pos_transactions pt,
       jsonb_array_elements(pt.items) AS item
  WHERE (item->>'variantId')::uuid = pv.id
);
