
-- Merge duplicate variants for KRUSHI CHILLI POWDER HOT and similar products
-- This will consolidate stock and keep the variant with barcode

-- Step 1: For KRUSHI CHILLI POWDER HOT 500 gm variants
-- Transfer stock from variant without barcode to variant with barcode
UPDATE product_variants
SET stock_quantity = (
    SELECT SUM(pv2.stock_quantity)
    FROM product_variants pv2
    WHERE pv2.product_id = '4f7d9955-7651-49d6-8c8a-6080c6858c07'
      AND pv2.label = '500 gm'
  ),
  updated_at = NOW()
WHERE id = '65eb105f-0f53-462b-8b02-86f86e5e9de3';

-- Update inventory layers to point to the correct variant
UPDATE inventory_layers
SET variant_id = '65eb105f-0f53-462b-8b02-86f86e5e9de3',
    updated_at = NOW()
WHERE variant_id = '3252c4f9-aebd-4f89-ba71-1712682859b1';

-- Update purchase items to point to the correct variant
UPDATE purchase_items
SET variant_id = '65eb105f-0f53-462b-8b02-86f86e5e9de3'
WHERE variant_id = '3252c4f9-aebd-4f89-ba71-1712682859b1';

-- Delete the duplicate variant without barcode
DELETE FROM product_variants
WHERE id = '3252c4f9-aebd-4f89-ba71-1712682859b1';

-- Step 2: Clean up other duplicates for this product
-- Merge duplicate 200 gm variants (keep the first one)
UPDATE product_variants
SET stock_quantity = (
    SELECT SUM(pv2.stock_quantity)
    FROM product_variants pv2
    WHERE pv2.product_id = '4f7d9955-7651-49d6-8c8a-6080c6858c07'
      AND pv2.label = '200 gm'
  ),
  updated_at = NOW()
WHERE id = '89c4f223-f35e-4c59-a5c1-b33594532aee';

-- Update references to the duplicate 200 gm variant
UPDATE inventory_layers
SET variant_id = '89c4f223-f35e-4c59-a5c1-b33594532aee'
WHERE variant_id = '72149570-de91-4849-8c68-ca21aaf37708';

UPDATE purchase_items
SET variant_id = '89c4f223-f35e-4c59-a5c1-b33594532aee'
WHERE variant_id = '72149570-de91-4849-8c68-ca21aaf37708';

DELETE FROM product_variants
WHERE id = '72149570-de91-4849-8c68-ca21aaf37708';

-- Merge duplicate 1 kg variants
UPDATE product_variants
SET stock_quantity = (
    SELECT SUM(pv2.stock_quantity)
    FROM product_variants pv2
    WHERE pv2.product_id = '4f7d9955-7651-49d6-8c8a-6080c6858c07'
      AND pv2.label = '1 kg'
  ),
  updated_at = NOW()
WHERE id = '7aaae7ad-4bd3-4f11-898d-4432c7fff47c';

UPDATE inventory_layers
SET variant_id = '7aaae7ad-4bd3-4f11-898d-4432c7fff47c'
WHERE variant_id = 'f95970cb-934e-443a-941c-20e8cd62b2d0';

UPDATE purchase_items
SET variant_id = '7aaae7ad-4bd3-4f11-898d-4432c7fff47c'
WHERE variant_id = 'f95970cb-934e-443a-941c-20e8cd62b2d0';

DELETE FROM product_variants
WHERE id = 'f95970cb-934e-443a-941c-20e8cd62b2d0';
