-- Let's see what policies exist and then fix them properly
-- First, drop ALL existing INSERT policies on orders
DROP POLICY IF EXISTS "Authenticated users can create their orders" ON public.orders;
DROP POLICY IF EXISTS "Anyone can create guest orders" ON public.orders;
DROP POLICY IF EXISTS "Users and guests can create orders" ON public.orders;
DROP POLICY IF EXISTS "Users can create orders" ON public.orders;

-- Create a single comprehensive INSERT policy that handles both cases
-- Using a single policy avoids any interaction issues
CREATE POLICY "Allow order creation for authenticated and guest users"
ON public.orders
FOR INSERT
WITH CHECK (
  -- Case 1: Authenticated users creating their own orders
  (auth.uid() IS NOT NULL AND auth.uid() = user_id)
  OR
  -- Case 2: Guest orders (anyone can create orders with null user_id)
  (user_id IS NULL)
);