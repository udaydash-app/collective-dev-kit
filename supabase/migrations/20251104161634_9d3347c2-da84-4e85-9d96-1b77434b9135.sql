-- Add back 30 pieces incorrectly deducted from SHIKHAR DB
UPDATE products
SET 
  stock_quantity = stock_quantity + 30,
  updated_at = now()
WHERE id = '06791bc6-f41f-440f-8603-e5bca6cb18c3';