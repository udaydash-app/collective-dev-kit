
-- Consolidate duplicate variants across all products

-- 1. KURKURE MAGIC MUNCH - Merge 75 gm variants (keep the one with purchase records)
UPDATE product_variants
SET stock_quantity = (
    SELECT SUM(pv2.stock_quantity)
    FROM product_variants pv2
    WHERE pv2.product_id = '7c82cd7b-fa1c-4de4-a035-7380eb8c68f8'
      AND pv2.label = '75 gm'
  ),
  cost_price = COALESCE(cost_price, (
    SELECT pv2.cost_price 
    FROM product_variants pv2
    WHERE pv2.product_id = '7c82cd7b-fa1c-4de4-a035-7380eb8c68f8'
      AND pv2.label = '75 gm'
      AND pv2.cost_price IS NOT NULL
    LIMIT 1
  )),
  updated_at = NOW()
WHERE id = '28fc783b-2a97-4079-848b-a8ecc8f28146';

-- Update references to point to kept variant
UPDATE inventory_layers
SET variant_id = '28fc783b-2a97-4079-848b-a8ecc8f28146'
WHERE variant_id = 'a1ca3c59-043f-495d-b1ae-441830648156';

UPDATE purchase_items
SET variant_id = '28fc783b-2a97-4079-848b-a8ecc8f28146'
WHERE variant_id = 'a1ca3c59-043f-495d-b1ae-441830648156';

-- Delete duplicate
DELETE FROM product_variants
WHERE id = 'a1ca3c59-043f-495d-b1ae-441830648156';

-- 2. PRESTIGE BOOK - Merge 1 pcs variants (keep first one, choose best price)
UPDATE product_variants
SET price = GREATEST(
    COALESCE((SELECT price FROM product_variants WHERE id = '01f2486e-00b6-49ce-b8c4-c4e9a48432d2'), 0),
    COALESCE((SELECT price FROM product_variants WHERE id = '172c13b7-f478-4bcb-9d48-afe82c551fcc'), 0),
    COALESCE((SELECT price FROM product_variants WHERE id = 'a6c0041e-968b-4589-8fce-198d4e1fcca5'), 0)
  ),
  updated_at = NOW()
WHERE id = '01f2486e-00b6-49ce-b8c4-c4e9a48432d2';

-- Update references
UPDATE inventory_layers
SET variant_id = '01f2486e-00b6-49ce-b8c4-c4e9a48432d2'
WHERE variant_id IN ('172c13b7-f478-4bcb-9d48-afe82c551fcc', 'a6c0041e-968b-4589-8fce-198d4e1fcca5');

UPDATE purchase_items
SET variant_id = '01f2486e-00b6-49ce-b8c4-c4e9a48432d2'
WHERE variant_id IN ('172c13b7-f478-4bcb-9d48-afe82c551fcc', 'a6c0041e-968b-4589-8fce-198d4e1fcca5');

-- Delete duplicates
DELETE FROM product_variants
WHERE id IN ('172c13b7-f478-4bcb-9d48-afe82c551fcc', 'a6c0041e-968b-4589-8fce-198d4e1fcca5');

-- 3. General cleanup: Find and merge any other simple duplicates (same product_id, label, AND barcode)
WITH duplicate_groups AS (
  SELECT 
    product_id,
    label,
    barcode,
    array_agg(id ORDER BY created_at) as variant_ids,
    COUNT(*) as count
  FROM product_variants
  WHERE barcode IS NOT NULL
  GROUP BY product_id, label, barcode
  HAVING COUNT(*) > 1
)
UPDATE product_variants pv
SET stock_quantity = (
    SELECT SUM(pv2.stock_quantity)
    FROM product_variants pv2
    WHERE pv2.id = ANY(dg.variant_ids)
  ),
  cost_price = COALESCE(pv.cost_price, (
    SELECT pv2.cost_price
    FROM product_variants pv2
    WHERE pv2.id = ANY(dg.variant_ids)
      AND pv2.cost_price IS NOT NULL
    ORDER BY pv2.created_at DESC
    LIMIT 1
  )),
  updated_at = NOW()
FROM duplicate_groups dg
WHERE pv.id = dg.variant_ids[1];

-- Move inventory layers to kept variants
WITH duplicate_groups AS (
  SELECT 
    product_id,
    label,
    barcode,
    array_agg(id ORDER BY created_at) as variant_ids
  FROM product_variants
  WHERE barcode IS NOT NULL
  GROUP BY product_id, label, barcode
  HAVING COUNT(*) > 1
)
UPDATE inventory_layers il
SET variant_id = dg.variant_ids[1],
    updated_at = NOW()
FROM duplicate_groups dg
WHERE il.variant_id = ANY(dg.variant_ids[2:]);

-- Move purchase items to kept variants
WITH duplicate_groups AS (
  SELECT 
    product_id,
    label,
    barcode,
    array_agg(id ORDER BY created_at) as variant_ids
  FROM product_variants
  WHERE barcode IS NOT NULL
  GROUP BY product_id, label, barcode
  HAVING COUNT(*) > 1
)
UPDATE purchase_items pi
SET variant_id = dg.variant_ids[1]
FROM duplicate_groups dg
WHERE pi.variant_id = ANY(dg.variant_ids[2:]);

-- Delete remaining duplicates
WITH duplicate_groups AS (
  SELECT 
    product_id,
    label,
    barcode,
    array_agg(id ORDER BY created_at) as variant_ids
  FROM product_variants
  WHERE barcode IS NOT NULL
  GROUP BY product_id, label, barcode
  HAVING COUNT(*) > 1
)
DELETE FROM product_variants pv
USING duplicate_groups dg
WHERE pv.id = ANY(dg.variant_ids[2:]);
