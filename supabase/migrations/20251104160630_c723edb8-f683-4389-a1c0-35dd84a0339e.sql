-- Fix decrement functions to avoid parameter ambiguity
DROP FUNCTION IF EXISTS decrement_product_stock(UUID, INTEGER);
DROP FUNCTION IF EXISTS decrement_variant_stock(UUID, INTEGER);

-- Function to decrement product stock with unambiguous parameters
CREATE OR REPLACE FUNCTION decrement_product_stock(p_product_id UUID, p_quantity INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE products
  SET 
    stock_quantity = GREATEST(0, stock_quantity - p_quantity),
    updated_at = now()
  WHERE id = p_product_id;
END;
$$;

-- Function to decrement variant stock with unambiguous parameters
CREATE OR REPLACE FUNCTION decrement_variant_stock(p_variant_id UUID, p_quantity INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE product_variants
  SET 
    stock_quantity = GREATEST(0, stock_quantity - p_quantity),
    updated_at = now()
  WHERE id = p_variant_id;
END;
$$;