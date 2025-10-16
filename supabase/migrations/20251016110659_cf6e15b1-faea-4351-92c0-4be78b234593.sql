-- Security hardening: Add explicit anonymous access denial policies

-- Deny anonymous access to profiles
CREATE POLICY "Deny anonymous access to profiles"
  ON public.profiles FOR SELECT
  TO anon
  USING (false);

-- Deny anonymous access to addresses
CREATE POLICY "Deny anonymous access to addresses"
  ON public.addresses FOR SELECT
  TO anon
  USING (false);

-- Deny anonymous access to payment_methods
CREATE POLICY "Deny anonymous access to payment_methods"
  ON public.payment_methods FOR SELECT
  TO anon
  USING (false);

-- Deny anonymous access to orders
CREATE POLICY "Deny anonymous access to orders"
  ON public.orders FOR SELECT
  TO anon
  USING (false);

-- Deny anonymous access to cart_items
CREATE POLICY "Deny anonymous access to cart_items"
  ON public.cart_items FOR SELECT
  TO anon
  USING (false);

-- Deny anonymous access to favorites
CREATE POLICY "Deny anonymous access to favorites"
  ON public.favorites FOR SELECT
  TO anon
  USING (false);

-- Add UPDATE policy for orders (allow users to cancel/modify their orders)
CREATE POLICY "Users can update their own orders"
  ON public.orders FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND status IN ('pending', 'confirmed'));

-- Fix function search path security issue
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TEXT AS $$
BEGIN
  RETURN 'ORD-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 10));
END;
$$ LANGUAGE plpgsql SET search_path TO 'public';