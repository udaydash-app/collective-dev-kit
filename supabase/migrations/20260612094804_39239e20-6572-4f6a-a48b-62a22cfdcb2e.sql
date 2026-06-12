
-- cash_register_entries
REVOKE ALL ON public.cash_register_entries FROM anon;
REVOKE ALL ON public.cash_register_entries FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_register_entries TO authenticated;
GRANT ALL ON public.cash_register_entries TO service_role;

DROP POLICY IF EXISTS "Public read cash register entries" ON public.cash_register_entries;
DROP POLICY IF EXISTS "Public insert cash register entries" ON public.cash_register_entries;
DROP POLICY IF EXISTS "Public update cash register entries" ON public.cash_register_entries;
DROP POLICY IF EXISTS "Public delete cash register entries" ON public.cash_register_entries;
DROP POLICY IF EXISTS "Anyone can view cash register entries" ON public.cash_register_entries;
DROP POLICY IF EXISTS "Anyone can insert cash register entries" ON public.cash_register_entries;
DROP POLICY IF EXISTS "Anyone can update cash register entries" ON public.cash_register_entries;
DROP POLICY IF EXISTS "Anyone can delete cash register entries" ON public.cash_register_entries;

CREATE POLICY "Admins can view cash register entries"
  ON public.cash_register_entries FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert cash register entries"
  ON public.cash_register_entries FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update cash register entries"
  ON public.cash_register_entries FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete cash register entries"
  ON public.cash_register_entries FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- trading_quote_items
REVOKE ALL ON public.trading_quote_items FROM anon;
REVOKE ALL ON public.trading_quote_items FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trading_quote_items TO authenticated;
GRANT ALL ON public.trading_quote_items TO service_role;

DROP POLICY IF EXISTS "Anyone can view trading quote items" ON public.trading_quote_items;
DROP POLICY IF EXISTS "Anyone can insert trading quote items" ON public.trading_quote_items;
DROP POLICY IF EXISTS "Anyone can update trading quote items" ON public.trading_quote_items;
DROP POLICY IF EXISTS "Anyone can delete trading quote items" ON public.trading_quote_items;

CREATE POLICY "Admins can view trading quote items"
  ON public.trading_quote_items FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert trading quote items"
  ON public.trading_quote_items FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update trading quote items"
  ON public.trading_quote_items FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete trading quote items"
  ON public.trading_quote_items FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
