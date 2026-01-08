-- Correct doubled stock from purchases since Jan 1, 2026
-- The duplicate trigger caused each purchase item to add stock twice

-- Fix products (items without variants)
UPDATE products p
SET stock_quantity = COALESCE(p.stock_quantity, 0) - sub.total_qty,
    updated_at = NOW()
FROM (
  SELECT pi.product_id, SUM(pi.quantity) as total_qty
  FROM purchase_items pi
  JOIN purchases pur ON pi.purchase_id = pur.id
  WHERE pur.created_at >= '2026-01-01'
    AND pi.variant_id IS NULL
  GROUP BY pi.product_id
) sub
WHERE p.id = sub.product_id;

-- Fix product variants (items with variant_id)
UPDATE product_variants pv
SET stock_quantity = COALESCE(pv.stock_quantity, 0) - sub.total_qty,
    updated_at = NOW()
FROM (
  SELECT pi.variant_id, SUM(pi.quantity) as total_qty
  FROM purchase_items pi
  JOIN purchases pur ON pi.purchase_id = pur.id
  WHERE pur.created_at >= '2026-01-01'
    AND pi.variant_id IS NOT NULL
  GROUP BY pi.variant_id
) sub
WHERE pv.id = sub.variant_id;