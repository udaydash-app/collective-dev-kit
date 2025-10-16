-- Allow NULL prices in products table or default to 0
ALTER TABLE products ALTER COLUMN price DROP NOT NULL;
ALTER TABLE products ALTER COLUMN price SET DEFAULT 0;

-- Update any existing NULL prices to 0
UPDATE products SET price = 0 WHERE price IS NULL;