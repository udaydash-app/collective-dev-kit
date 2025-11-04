-- Fix search_path for stock decrement functions
DROP FUNCTION IF EXISTS decrement_product_stock(UUID, INTEGER);
DROP FUNCTION IF EXISTS decrement_variant_stock(UUID, INTEGER);

-- Function to decrement product stock with proper search_path
CREATE OR REPLACE FUNCTION decrement_product_stock(product_id UUID, quantity INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE products
  SET 
    stock_quantity = GREATEST(0, stock_quantity - quantity),
    updated_at = now()
  WHERE id = product_id;
END;
$$;

-- Function to decrement variant stock with proper search_path
CREATE OR REPLACE FUNCTION decrement_variant_stock(variant_id UUID, quantity INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE product_variants
  SET 
    stock_quantity = GREATEST(0, stock_quantity - quantity),
    updated_at = now()
  WHERE id = variant_id;
END;
$$;