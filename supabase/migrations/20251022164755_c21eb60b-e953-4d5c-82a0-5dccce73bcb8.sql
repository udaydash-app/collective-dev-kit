
-- The issue is that the Supabase anon key uses the 'anon' role, not 'public'
-- We need to create a policy specifically for the anon role

DROP POLICY IF EXISTS "Guest orders allowed" ON public.orders;

-- Create policy for anon role (anonymous users with anon key)
CREATE POLICY "Guest orders allowed"
ON public.orders
FOR INSERT
TO anon
WITH CHECK (user_id IS NULL);
