-- Add cost_price to products table
ALTER TABLE products 
ADD COLUMN cost_price numeric;

-- Add cost_price and barcode to product_variants table
ALTER TABLE product_variants 
ADD COLUMN cost_price numeric,
ADD COLUMN barcode text;

-- Add comments for documentation
COMMENT ON COLUMN products.cost_price IS 'Cost price of the product for profit calculation';
COMMENT ON COLUMN product_variants.cost_price IS 'Cost price of the variant for profit calculation';
COMMENT ON COLUMN product_variants.barcode IS 'Barcode specific to this variant';