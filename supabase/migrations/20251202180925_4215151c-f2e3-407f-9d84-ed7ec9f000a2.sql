-- Delete purchase_items referencing these products
DELETE FROM purchase_items 
WHERE product_id IN (
  SELECT p.id FROM products p
  WHERE p.is_available = false
  AND EXISTS (SELECT 1 FROM product_variants pv WHERE pv.product_id = p.id)
);

-- Delete cart_items referencing these products
DELETE FROM cart_items 
WHERE product_id IN (
  SELECT p.id FROM products p
  WHERE p.is_available = false
  AND EXISTS (SELECT 1 FROM product_variants pv WHERE pv.product_id = p.id)
);

-- Delete product_variants for these products
DELETE FROM product_variants 
WHERE product_id IN (
  SELECT p.id FROM products p
  WHERE p.is_available = false
  AND EXISTS (SELECT 1 FROM product_variants pv WHERE pv.product_id = p.id)
);

-- Delete the products themselves
DELETE FROM products 
WHERE is_available = false
AND id IN (
  SELECT DISTINCT p.id FROM products p
  INNER JOIN product_variants pv ON pv.product_id = p.id
  WHERE p.is_available = false
);