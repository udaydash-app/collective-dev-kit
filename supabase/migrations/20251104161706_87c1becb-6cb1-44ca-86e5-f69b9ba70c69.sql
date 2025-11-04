-- Correct SHIKHAR DB stock to reflect actual purchases and sales
-- Purchased: 300, Sold: 120, Expected: 180
UPDATE products
SET 
  stock_quantity = 180,
  updated_at = now()
WHERE id = '06791bc6-f41f-440f-8603-e5bca6cb18c3';