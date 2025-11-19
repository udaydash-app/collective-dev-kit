-- Reset stock quantities to match inventory layers
-- This removes orphaned stock that has no cost tracking

-- Update products (no variants) to match their inventory layers
UPDATE products p
SET stock_quantity = COALESCE(layer_totals.total, 0),
    updated_at = NOW()
FROM (
  SELECT product_id, SUM(quantity_remaining) as total
  FROM inventory_layers
  WHERE variant_id IS NULL
  GROUP BY product_id
) layer_totals
WHERE p.id = layer_totals.product_id
  AND p.stock_quantity != layer_totals.total;

-- Update products with no layers to 0 stock
UPDATE products
SET stock_quantity = 0,
    updated_at = NOW()
WHERE stock_quantity > 0
  AND id NOT IN (
    SELECT DISTINCT product_id 
    FROM inventory_layers 
    WHERE variant_id IS NULL
  );

-- Update product variants to match their inventory layers
UPDATE product_variants pv
SET stock_quantity = COALESCE(layer_totals.total, 0),
    updated_at = NOW()
FROM (
  SELECT variant_id, SUM(quantity_remaining) as total
  FROM inventory_layers
  WHERE variant_id IS NOT NULL
  GROUP BY variant_id
) layer_totals
WHERE pv.id = layer_totals.variant_id
  AND pv.stock_quantity != layer_totals.total;

-- Update variants with no layers to 0 stock
UPDATE product_variants
SET stock_quantity = 0,
    updated_at = NOW()
WHERE stock_quantity > 0
  AND id NOT IN (
    SELECT DISTINCT variant_id 
    FROM inventory_layers 
    WHERE variant_id IS NOT NULL
  );