
-- Delete the blocking inventory layer for MAGGI NOODLES variant
DELETE FROM inventory_layers 
WHERE variant_id = 'e95093e7-b01f-4657-8f25-a09761852bda';

-- Update variant stock to 0
UPDATE product_variants 
SET stock_quantity = 0 
WHERE id = 'e95093e7-b01f-4657-8f25-a09761852bda';

-- Update product stock to 0
UPDATE products 
SET stock_quantity = 0 
WHERE id = 'd0b79f2a-b694-4470-a9cd-09223305e5e7';
