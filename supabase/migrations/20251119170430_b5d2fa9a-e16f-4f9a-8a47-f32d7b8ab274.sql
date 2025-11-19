-- Remove duplicate product variants by:
-- 1. Keeping variants with purchase/inventory history
-- 2. Updating references from duplicates to the variant we keep
-- 3. Then deleting the duplicates

-- LAYS CHILLI LIME: Update references and delete duplicate
-- Keep variant 2df9519b-6a09-47e8-b378-671d3fd065bd (stock 3590)
UPDATE purchase_items SET variant_id = '2df9519b-6a09-47e8-b378-671d3fd065bd'
WHERE variant_id = 'e09d4d3f-2aff-49e0-8d29-9e9cacb0e90a';

UPDATE inventory_layers SET variant_id = '2df9519b-6a09-47e8-b378-671d3fd065bd'
WHERE variant_id = 'e09d4d3f-2aff-49e0-8d29-9e9cacb0e90a';

UPDATE cart_items SET variant_id = '2df9519b-6a09-47e8-b378-671d3fd065bd'
WHERE variant_id = 'e09d4d3f-2aff-49e0-8d29-9e9cacb0e90a';

DELETE FROM product_variants WHERE id = 'e09d4d3f-2aff-49e0-8d29-9e9cacb0e90a';

-- LAYS CLASSIC SALTED: Keep variant with purchase history (a17a34cd-3ff3-406b-bd20-635e6cf612eb)
-- Update all references from other variants to this one
UPDATE purchase_items SET variant_id = 'a17a34cd-3ff3-406b-bd20-635e6cf612eb'
WHERE variant_id IN ('63dce89c-5522-4f32-ac37-34d0c63e77a3', 'dadd731a-9b4d-4b12-843b-60749091829d', '15847774-d8eb-4518-83a8-9a968a2daf62');

UPDATE inventory_layers SET variant_id = 'a17a34cd-3ff3-406b-bd20-635e6cf612eb'
WHERE variant_id IN ('63dce89c-5522-4f32-ac37-34d0c63e77a3', 'dadd731a-9b4d-4b12-843b-60749091829d', '15847774-d8eb-4518-83a8-9a968a2daf62');

UPDATE cart_items SET variant_id = 'a17a34cd-3ff3-406b-bd20-635e6cf612eb'
WHERE variant_id IN ('63dce89c-5522-4f32-ac37-34d0c63e77a3', 'dadd731a-9b4d-4b12-843b-60749091829d', '15847774-d8eb-4518-83a8-9a968a2daf62');

DELETE FROM product_variants 
WHERE id IN ('63dce89c-5522-4f32-ac37-34d0c63e77a3', 'dadd731a-9b4d-4b12-843b-60749091829d', '15847774-d8eb-4518-83a8-9a968a2daf62');

-- LAYS CREAM & ONION: Keep one variant (98a743a6-71ef-4b43-b501-0408c030b4f2 with stock 3517)
UPDATE purchase_items SET variant_id = '98a743a6-71ef-4b43-b501-0408c030b4f2'
WHERE variant_id IN ('1c79a837-8ff8-439e-a30f-5c4eab889eef', 'e6306f4b-6a9b-4c82-bcb7-72a806ec8364');

UPDATE inventory_layers SET variant_id = '98a743a6-71ef-4b43-b501-0408c030b4f2'
WHERE variant_id IN ('1c79a837-8ff8-439e-a30f-5c4eab889eef', 'e6306f4b-6a9b-4c82-bcb7-72a806ec8364');

UPDATE cart_items SET variant_id = '98a743a6-71ef-4b43-b501-0408c030b4f2'
WHERE variant_id IN ('1c79a837-8ff8-439e-a30f-5c4eab889eef', 'e6306f4b-6a9b-4c82-bcb7-72a806ec8364');

DELETE FROM product_variants 
WHERE id IN ('1c79a837-8ff8-439e-a30f-5c4eab889eef', 'e6306f4b-6a9b-4c82-bcb7-72a806ec8364');

-- LAYS MAGIC MASALA: Keep one variant (4ede34e7-a76a-499f-933e-b33ce0d6237e with stock 3510)
UPDATE purchase_items SET variant_id = '4ede34e7-a76a-499f-933e-b33ce0d6237e'
WHERE variant_id IN ('ceb7d3b1-1e02-4a84-8abb-c22ffa08a7c5', 'c6e560d3-c126-464e-83ee-aadc60de1f4c');

UPDATE inventory_layers SET variant_id = '4ede34e7-a76a-499f-933e-b33ce0d6237e'
WHERE variant_id IN ('ceb7d3b1-1e02-4a84-8abb-c22ffa08a7c5', 'c6e560d3-c126-464e-83ee-aadc60de1f4c');

UPDATE cart_items SET variant_id = '4ede34e7-a76a-499f-933e-b33ce0d6237e'
WHERE variant_id IN ('ceb7d3b1-1e02-4a84-8abb-c22ffa08a7c5', 'c6e560d3-c126-464e-83ee-aadc60de1f4c');

DELETE FROM product_variants 
WHERE id IN ('ceb7d3b1-1e02-4a84-8abb-c22ffa08a7c5', 'c6e560d3-c126-464e-83ee-aadc60de1f4c');