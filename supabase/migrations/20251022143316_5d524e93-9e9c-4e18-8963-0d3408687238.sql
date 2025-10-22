-- Drop the existing combined policy
DROP POLICY IF EXISTS "Users and guests can create orders" ON public.orders;

-- Create separate PERMISSIVE policies for better handling

-- Policy 1: Allow authenticated users to create orders for themselves
CREATE POLICY "Authenticated users can create their orders"
ON public.orders
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Policy 2: Allow ANYONE (including anonymous) to create guest orders
-- This is permissive, so it works alongside the authenticated policy
CREATE POLICY "Anyone can create guest orders"
ON public.orders
FOR INSERT
WITH CHECK (user_id IS NULL);