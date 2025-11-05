
-- Update STUTE JAM variants with descriptive labels based on barcode
UPDATE product_variants
SET label = CASE 
  WHEN barcode = '4006424022358' THEN 'Strawberry 450g'
  WHEN barcode = '4006424022372' THEN 'Apricot 450g'
  WHEN barcode = '4006424022389' THEN 'Raspberry 450g'
  ELSE label
END,
updated_at = NOW()
WHERE product_id = (SELECT id FROM products WHERE name = 'STUTE JAM' LIMIT 1)
  AND barcode IN ('4006424022358', '4006424022372', '4006424022389');

-- Update VICTORIA ORANGE GREEN TEA variants with descriptive labels based on barcode
UPDATE product_variants
SET label = CASE 
  WHEN barcode = '6036000114007' THEN 'Orange Flavor 25s'
  WHEN barcode = '8901035053752' THEN 'Green Tea 25s'
  WHEN barcode = '8901035054070' THEN 'Lemon Flavor 25s'
  ELSE label
END,
updated_at = NOW()
WHERE product_id = (SELECT id FROM products WHERE name = 'VICTORIA ORANGE GREEN TEA' LIMIT 1)
  AND barcode IN ('6036000114007', '8901035053752', '8901035054070');
