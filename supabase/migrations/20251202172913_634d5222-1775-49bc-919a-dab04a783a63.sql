-- Add is_available_online column to products table
ALTER TABLE products 
ADD COLUMN is_available_online boolean DEFAULT true;

-- Update existing products to be available online by default
UPDATE products SET is_available_online = true WHERE is_available_online IS NULL;