DROP POLICY IF EXISTS "Public can view" ON public.restaurant_tables;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.restaurant_tables FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_tables TO authenticated;
GRANT ALL ON public.restaurant_tables TO service_role;