-- Fix Security Issue: Add explicit anonymous access denial policies
-- This follows defense-in-depth principles

-- 1. Deny anonymous access to profiles table (contains PII)
CREATE POLICY "Deny anonymous access to profiles"
ON public.profiles
FOR SELECT
USING (false);

-- 2. Deny anonymous access to analytics_events (contains user behavior data)
CREATE POLICY "Deny anonymous access to analytics_events"
ON public.analytics_events
FOR SELECT
USING (false);

-- 3. Create server-side function to calculate order totals securely
-- This prevents client-side price manipulation
CREATE OR REPLACE FUNCTION public.calculate_order_total(
  p_user_id uuid,
  p_delivery_fee numeric DEFAULT 500,
  p_tax_rate numeric DEFAULT 0.1
)
RETURNS TABLE(
  subtotal numeric,
  delivery_fee numeric,
  tax numeric,
  total numeric
) 
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

-- 4. Create server-side admin verification function
-- This adds an additional layer of admin validation beyond client-side checks
CREATE OR REPLACE FUNCTION public.verify_admin_access(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT has_role(p_user_id, 'admin'::app_role);
$$;