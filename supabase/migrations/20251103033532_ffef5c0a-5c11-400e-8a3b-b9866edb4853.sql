-- Create price tier enum
CREATE TYPE price_tier AS ENUM ('retail', 'wholesale', 'vip');

-- Add price_tier to contacts
ALTER TABLE contacts
ADD COLUMN price_tier price_tier DEFAULT 'retail';

-- Add wholesale and VIP prices to products
ALTER TABLE products
ADD COLUMN wholesale_price numeric,
ADD COLUMN vip_price numeric;

-- Add wholesale and VIP prices to product_variants
ALTER TABLE product_variants
ADD COLUMN wholesale_price numeric,
ADD COLUMN vip_price numeric;

-- Add comments for clarity
COMMENT ON COLUMN contacts.price_tier IS 'Customer price tier: retail (default), wholesale, or vip';
COMMENT ON COLUMN products.wholesale_price IS 'Wholesale price for wholesale customers';
COMMENT ON COLUMN products.vip_price IS 'VIP price for VIP customers';
COMMENT ON COLUMN product_variants.wholesale_price IS 'Wholesale price for wholesale customers';
COMMENT ON COLUMN product_variants.vip_price IS 'VIP price for VIP customers';