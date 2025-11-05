
-- Update product cost_price from most recent inventory layer with non-zero cost
UPDATE products p
SET cost_price = il.recent_cost,
    updated_at = now()
FROM (
  SELECT DISTINCT ON (product_id) 
    product_id,
    unit_cost as recent_cost
  FROM inventory_layers
  WHERE variant_id IS NULL 
    AND unit_cost > 0
  ORDER BY product_id, purchased_at DESC
) il
WHERE p.id = il.product_id 
  AND (p.cost_price IS NULL OR p.cost_price = 0);

-- Also update variant cost_price from their inventory layers
UPDATE product_variants pv
SET cost_price = il.recent_cost,
    updated_at = now()
FROM (
  SELECT DISTINCT ON (variant_id) 
    variant_id,
    unit_cost as recent_cost
  FROM inventory_layers
  WHERE variant_id IS NOT NULL 
    AND unit_cost > 0
  ORDER BY variant_id, purchased_at DESC
) il
WHERE pv.id = il.variant_id 
  AND (pv.cost_price IS NULL OR pv.cost_price = 0);
