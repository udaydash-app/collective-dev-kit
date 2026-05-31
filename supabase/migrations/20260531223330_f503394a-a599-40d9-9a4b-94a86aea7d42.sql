-- Fix 1: pos_sticky_notes - restrict to admin/cashier only
DROP POLICY IF EXISTS "Authenticated users can view sticky notes" ON public.pos_sticky_notes;
DROP POLICY IF EXISTS "Authenticated users can insert sticky notes" ON public.pos_sticky_notes;
DROP POLICY IF EXISTS "Authenticated users can update sticky notes" ON public.pos_sticky_notes;
DROP POLICY IF EXISTS "Authenticated users can delete sticky notes" ON public.pos_sticky_notes;
DROP POLICY IF EXISTS "Authenticated can view sticky notes" ON public.pos_sticky_notes;
DROP POLICY IF EXISTS "Authenticated can insert sticky notes" ON public.pos_sticky_notes;
DROP POLICY IF EXISTS "Authenticated can update sticky notes" ON public.pos_sticky_notes;
DROP POLICY IF EXISTS "Authenticated can delete sticky notes" ON public.pos_sticky_notes;

CREATE POLICY "Staff can view sticky notes" ON public.pos_sticky_notes
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'cashier'));
CREATE POLICY "Staff can insert sticky notes" ON public.pos_sticky_notes
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'cashier'));
CREATE POLICY "Staff can update sticky notes" ON public.pos_sticky_notes
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'cashier'));
CREATE POLICY "Staff can delete sticky notes" ON public.pos_sticky_notes
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'cashier'));

-- Fix 2: restaurant-assets storage bucket - keep public read, restrict writes to staff
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND (qual ILIKE '%restaurant-assets%' OR with_check ILIKE '%restaurant-assets%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "restaurant-assets public read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'restaurant-assets');
CREATE POLICY "restaurant-assets staff insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'restaurant-assets' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'cashier')));
CREATE POLICY "restaurant-assets staff update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'restaurant-assets' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'cashier')));
CREATE POLICY "restaurant-assets staff delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'restaurant-assets' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'cashier')));

-- Fix 3: restaurant_* tables - remove anon full write, allow staff only.
-- Public-facing menu tables keep SELECT for anon.
DO $$
DECLARE
  t text;
  pol record;
  write_tables text[] := ARRAY[
    'restaurant_orders','restaurant_order_items','restaurant_payments',
    'restaurant_ingredients','restaurant_purchases','restaurant_purchase_items',
    'restaurant_recipes','restaurant_settings','restaurant_tables',
    'restaurant_menu_items','restaurant_menu_categories','restaurant_modifier_groups',
    'restaurant_modifiers','restaurant_item_modifier_groups'
  ];
  public_read_tables text[] := ARRAY[
    'restaurant_menu_items','restaurant_menu_categories','restaurant_modifier_groups',
    'restaurant_modifiers','restaurant_item_modifier_groups','restaurant_settings','restaurant_tables'
  ];
BEGIN
  FOREACH t IN ARRAY write_tables LOOP
    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname='public' AND tablename=t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, t);
    END LOOP;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    -- staff full access
    EXECUTE format($f$CREATE POLICY "Staff full access" ON public.%I
      FOR ALL TO authenticated
      USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'cashier'))
      WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'cashier'))$f$, t);

    -- public read for menu-related tables
    IF t = ANY(public_read_tables) THEN
      EXECUTE format($f$CREATE POLICY "Public can view" ON public.%I
        FOR SELECT TO anon, authenticated USING (true)$f$, t);
    END IF;
  END LOOP;
END $$;