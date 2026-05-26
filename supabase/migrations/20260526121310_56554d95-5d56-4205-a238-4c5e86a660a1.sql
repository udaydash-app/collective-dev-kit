
-- 1. Journal entries: drop generic user-scoped write policies
DROP POLICY IF EXISTS "Users can delete their own journal entries" ON public.journal_entries;
DROP POLICY IF EXISTS "Users can update their own journal entries" ON public.journal_entries;
DROP POLICY IF EXISTS "Users can view their own journal entries" ON public.journal_entries;
DROP POLICY IF EXISTS "Users can delete their own journal entry lines" ON public.journal_entry_lines;
DROP POLICY IF EXISTS "Users can update their own journal entry lines" ON public.journal_entry_lines;
DROP POLICY IF EXISTS "Users can insert their own journal entry lines" ON public.journal_entry_lines;
DROP POLICY IF EXISTS "Users can view their own journal entry lines" ON public.journal_entry_lines;

-- 2. POS users: require cashier role for self-read
DROP POLICY IF EXISTS "Cashiers can view own pos user" ON public.pos_users;
CREATE POLICY "Cashiers can view own pos user"
  ON public.pos_users
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() AND public.has_role(auth.uid(), 'cashier'::app_role));

-- 3. Product images storage: restrict writes to staff
DROP POLICY IF EXISTS "Authenticated users can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete product images" ON storage.objects;

CREATE POLICY "Staff can upload product images"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'product-images' AND (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'cashier'::app_role)));

CREATE POLICY "Staff can update product images"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'product-images' AND (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'cashier'::app_role)));

CREATE POLICY "Staff can delete product images"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'product-images' AND (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'cashier'::app_role)));

-- 4. Hide cost/wholesale/vip prices from anonymous users (column-level)
REVOKE SELECT (cost_price, wholesale_price, vip_price) ON public.products FROM anon;
REVOKE SELECT (cost_price, wholesale_price, vip_price) ON public.product_variants FROM anon;

-- 5. Profiles: remove cashier update of other profiles (prevents role escalation)
DROP POLICY IF EXISTS "Cashiers can update profiles" ON public.profiles;

-- 6. Walkie-talkie: restrict reads to staff
DROP POLICY IF EXISTS "Anyone can read walkie talkie audio" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete audio" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload audio" ON storage.objects;

CREATE POLICY "Staff can read walkie talkie audio"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'walkie-talkie' AND (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'cashier'::app_role)));

CREATE POLICY "Staff can upload walkie talkie audio"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'walkie-talkie' AND (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'cashier'::app_role)));

CREATE POLICY "Staff can delete walkie talkie audio"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'walkie-talkie' AND (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'cashier'::app_role)));
