-- Add admin access to addresses for order management
CREATE POLICY "Admins can view all addresses"
ON public.addresses
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));