-- Drop the existing restrictive policy for creating orders
DROP POLICY IF EXISTS "Users can create orders" ON public.orders;

-- Create a new policy that explicitly allows both authenticated users and guests to create orders
CREATE POLICY "Users and guests can create orders"
ON public.orders
FOR INSERT
WITH CHECK (
  -- Allow authenticated users to create orders for themselves
  (auth.uid() = user_id)
  OR
  -- Allow anyone (including anonymous users) to create guest orders
  (user_id IS NULL)
);