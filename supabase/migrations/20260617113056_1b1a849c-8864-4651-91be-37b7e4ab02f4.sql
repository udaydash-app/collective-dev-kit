
-- Block anonymous (unauthenticated) access to internal cost/wholesale/VIP price columns
REVOKE SELECT (cost_price, wholesale_price, vip_price) ON public.products FROM anon;
REVOKE SELECT (cost_price, wholesale_price, vip_price) ON public.product_variants FROM anon;

-- Tighten pos_users admin policies: scope to authenticated role (was {public})
DROP POLICY IF EXISTS "Admins can view all pos users" ON public.pos_users;
DROP POLICY IF EXISTS "Admins can insert pos users" ON public.pos_users;
DROP POLICY IF EXISTS "Admins can update pos users" ON public.pos_users;
DROP POLICY IF EXISTS "Admins can delete pos users" ON public.pos_users;

CREATE POLICY "Admins can view all pos users"
  ON public.pos_users FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert pos users"
  ON public.pos_users FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update pos users"
  ON public.pos_users FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete pos users"
  ON public.pos_users FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
