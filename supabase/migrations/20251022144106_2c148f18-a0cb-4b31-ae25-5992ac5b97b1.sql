-- The issue is that even with the anon role, the policy might not be evaluating correctly
-- Let's create a more explicit policy that doesn't rely on complex conditions

DROP POLICY IF EXISTS "Allow order creation for authenticated and guest users" ON public.orders;

-- Split into two separate permissive policies for clarity
-- Policy 1: For guest orders (user_id IS NULL) - allow everyone
CREATE POLICY "Guest orders allowed"
ON public.orders
FOR INSERT
WITH CHECK (user_id IS NULL);

-- Policy 2: For authenticated orders - only allow if user matches
CREATE POLICY "Authenticated user orders allowed"
ON public.orders
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);