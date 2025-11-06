
-- Reconcile all product stocks to match inventory layer calculations (FIFO)

-- Update products (no variants)
UPDATE products p
SET stock_quantity = (
  SELECT COALESCE(SUM(il.quantity_remaining), 0)
  FROM inventory_layers il
  WHERE il.product_id = p.id
    AND il.variant_id IS NULL
);

-- Update product variants
UPDATE product_variants pv
SET stock_quantity = (
  SELECT COALESCE(SUM(il.quantity_remaining), 0)
  FROM inventory_layers il
  WHERE il.variant_id = pv.id
);
