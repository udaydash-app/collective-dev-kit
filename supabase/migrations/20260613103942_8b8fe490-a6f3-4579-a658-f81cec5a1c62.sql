
-- 1. Hide internal pricing columns from anonymous (unauthenticated) browsers
REVOKE SELECT (cost_price, wholesale_price, vip_price) ON public.products FROM anon;
REVOKE SELECT (cost_price, wholesale_price, vip_price) ON public.product_variants FROM anon;

-- 2. Restrict trade_records and trade_contacts to admin/cashier only
DROP POLICY IF EXISTS "Authenticated can delete trade_records" ON public.trade_records;
DROP POLICY IF EXISTS "Authenticated can insert trade_records" ON public.trade_records;
DROP POLICY IF EXISTS "Authenticated can read trade_records"   ON public.trade_records;
DROP POLICY IF EXISTS "Authenticated can update trade_records" ON public.trade_records;

CREATE POLICY "Staff can read trade_records"   ON public.trade_records FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'cashier'::app_role));
CREATE POLICY "Staff can insert trade_records" ON public.trade_records FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'cashier'::app_role));
CREATE POLICY "Staff can update trade_records" ON public.trade_records FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'cashier'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'cashier'::app_role));
CREATE POLICY "Staff can delete trade_records" ON public.trade_records FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'cashier'::app_role));

DROP POLICY IF EXISTS "Authenticated can delete trade_contacts" ON public.trade_contacts;
DROP POLICY IF EXISTS "Authenticated can insert trade_contacts" ON public.trade_contacts;
DROP POLICY IF EXISTS "Authenticated can read trade_contacts"   ON public.trade_contacts;
DROP POLICY IF EXISTS "Authenticated can update trade_contacts" ON public.trade_contacts;

CREATE POLICY "Staff can read trade_contacts"   ON public.trade_contacts FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'cashier'::app_role));
CREATE POLICY "Staff can insert trade_contacts" ON public.trade_contacts FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'cashier'::app_role));
CREATE POLICY "Staff can update trade_contacts" ON public.trade_contacts FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'cashier'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'cashier'::app_role));
CREATE POLICY "Staff can delete trade_contacts" ON public.trade_contacts FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'cashier'::app_role));

-- 3. Lock down trading-quote-images bucket writes to staff
DROP POLICY IF EXISTS "Anyone upload trading quote images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone update trading quote images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone delete trading quote images" ON storage.objects;

CREATE POLICY "Staff can upload trading quote images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'trading-quote-images'
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'cashier'::app_role))
  );

CREATE POLICY "Staff can update trading quote images" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'trading-quote-images'
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'cashier'::app_role))
  );

CREATE POLICY "Staff can delete trading quote images" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'trading-quote-images'
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'cashier'::app_role))
  );
