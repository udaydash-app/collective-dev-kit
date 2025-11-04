-- Function to decrement product stock
CREATE OR REPLACE FUNCTION decrement_product_stock(product_id UUID, quantity INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE products
  SET 
    stock_quantity = GREATEST(0, stock_quantity - quantity),
    updated_at = now()
  WHERE id = product_id;
END;
$$;

-- Function to decrement variant stock
CREATE OR REPLACE FUNCTION decrement_variant_stock(variant_id UUID, quantity INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE product_variants
  SET 
    stock_quantity = GREATEST(0, stock_quantity - quantity),
    updated_at = now()
  WHERE id = variant_id;
END;
$$;