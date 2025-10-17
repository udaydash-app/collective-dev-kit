-- Update the calculate_order_total function to make delivery_fee and tax_rate optional with 0 defaults
DROP FUNCTION IF EXISTS public.calculate_order_total(uuid, numeric, numeric);

CREATE OR REPLACE FUNCTION public.calculate_order_total(
  p_user_id uuid,
  p_delivery_fee numeric DEFAULT 0,
  p_tax_rate numeric DEFAULT 0
)
RETURNS TABLE(subtotal numeric, delivery_fee numeric, tax numeric, total numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subtotal numeric;
BEGIN
  -- Calculate subtotal from actual product prices in user's cart
  SELECT COALESCE(SUM(p.price * ci.quantity), 0)
  INTO v_subtotal
  FROM cart_items ci
  JOIN products p ON p.id = ci.product_id
  WHERE ci.user_id = p_user_id
    AND p.is_available = true;
  
  -- Return calculated totals
  RETURN QUERY SELECT 
    v_subtotal,
    p_delivery_fee,
    ROUND(v_subtotal * p_tax_rate, 2),
    ROUND(v_subtotal + p_delivery_fee + (v_subtotal * p_tax_rate), 2);
END;
$$;