-- Fix historical stock discrepancies from deleted purchases
-- Update product and variant stock to match inventory layers

-- Update products where stock doesn't match inventory layers
WITH layer_totals AS (
  SELECT 
    product_id,
    SUM(quantity_remaining) as correct_stock
  FROM inventory_layers
  WHERE variant_id IS NULL
  GROUP BY product_id
)
UPDATE products p
SET stock_quantity = COALESCE(lt.correct_stock, 0),
    updated_at = NOW()
FROM layer_totals lt
WHERE p.id = lt.product_id
  AND p.stock_quantity != COALESCE(lt.correct_stock, 0);

-- Update product variants where stock doesn't match inventory layers
WITH layer_totals AS (
  SELECT 
    product_id,
    variant_id,
    SUM(quantity_remaining) as correct_stock
  FROM inventory_layers
  WHERE variant_id IS NOT NULL
  GROUP BY product_id, variant_id
)
UPDATE product_variants pv
SET stock_quantity = COALESCE(lt.correct_stock, 0),
    updated_at = NOW()
FROM layer_totals lt
WHERE pv.id = lt.variant_id
  AND pv.product_id = lt.product_id
  AND pv.stock_quantity != COALESCE(lt.correct_stock, 0);

-- Set stock to 0 for products with no inventory layers but positive stock
UPDATE products
SET stock_quantity = 0,
    updated_at = NOW()
WHERE stock_quantity > 0
  AND NOT EXISTS (
    SELECT 1 FROM inventory_layers 
    WHERE inventory_layers.product_id = products.id 
      AND inventory_layers.variant_id IS NULL
  );

-- Set stock to 0 for variants with no inventory layers but positive stock
UPDATE product_variants pv
SET stock_quantity = 0,
    updated_at = NOW()
WHERE stock_quantity > 0
  AND NOT EXISTS (
    SELECT 1 FROM inventory_layers 
    WHERE inventory_layers.variant_id = pv.id
  );