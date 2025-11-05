-- Fix inventory layers that have 0 cost but corresponding purchases have actual costs
UPDATE inventory_layers il
SET unit_cost = pi.unit_cost,
    updated_at = now()
FROM purchase_items pi
JOIN purchases p ON p.id = pi.purchase_id
WHERE il.purchase_id = p.id
  AND il.product_id = pi.product_id
  AND il.unit_cost = 0
  AND pi.unit_cost > 0;

-- Update product cost prices from the corrected inventory layers
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
  AND (p.cost_price = 0 OR p.cost_price IS NULL);

-- Update variant cost prices from the corrected inventory layers
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
  AND (pv.cost_price = 0 OR pv.cost_price IS NULL);