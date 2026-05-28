
-- 1) Hide internal margin columns from anonymous users via column-level privileges.
--    Authenticated staff (admin/cashier) and service_role retain full access.
REVOKE SELECT (cost_price, wholesale_price, vip_price) ON public.products FROM anon;
REVOKE SELECT (cost_price, wholesale_price, vip_price) ON public.product_variants FROM anon;

-- 2) Prevent self-elevation: tighten the "Users can update own profile" policy
--    so the role column cannot be changed by the user themselves.
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND role IS NOT DISTINCT FROM (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
);

-- 3) Make walkie-talkie bucket private; reads already go through download()/signed URLs.
UPDATE storage.buckets SET public = false WHERE id = 'walkie-talkie';
