-- Drop existing admin policy that already exists
DROP POLICY IF EXISTS "Admins can view all addresses" ON public.addresses;
DROP POLICY IF EXISTS "Admins can manage addresses" ON public.addresses;

-- Recreate admin policies with proper has_role check
CREATE POLICY "Admins can view all addresses"
ON public.addresses
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage addresses"
ON public.addresses
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));