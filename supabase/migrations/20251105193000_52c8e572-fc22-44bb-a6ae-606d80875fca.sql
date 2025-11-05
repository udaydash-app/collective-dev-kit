-- Update products directly from most recent purchase_items where cost is missing
UPDATE products p
SET cost_price = recent_purchase.unit_cost,
    updated_at = now()
FROM (
  SELECT DISTINCT ON (pi.product_id)
    pi.product_id,
    pi.unit_cost
  FROM purchase_items pi
  JOIN purchases pur ON pur.id = pi.purchase_id
  WHERE pi.unit_cost > 0
  ORDER BY pi.product_id, pur.purchased_at DESC
) recent_purchase
WHERE p.id = recent_purchase.product_id
  AND (p.cost_price = 0 OR p.cost_price IS NULL);

-- Update inventory layers from purchase_items by matching product and similar dates
UPDATE inventory_layers il
SET unit_cost = pi.unit_cost,
    purchase_id = p.id,
    updated_at = now()
FROM purchase_items pi
JOIN purchases p ON p.id = pi.purchase_id
WHERE il.product_id = pi.product_id
  AND il.variant_id IS NULL
  AND il.unit_cost = 0
  AND pi.unit_cost > 0
  AND il.purchased_at BETWEEN (p.purchased_at - interval '1 day') AND (p.purchased_at + interval '1 day');