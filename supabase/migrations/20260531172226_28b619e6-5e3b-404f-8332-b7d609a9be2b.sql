DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'restaurant_menu_items','restaurant_menu_categories','restaurant_tables',
    'restaurant_orders','restaurant_order_items','restaurant_settings',
    'restaurant_ingredients','restaurant_purchases','restaurant_purchase_items',
    'restaurant_recipes','restaurant_payments','restaurant_modifier_groups',
    'restaurant_modifiers','restaurant_item_modifier_groups'
  ]) LOOP
    EXECUTE format('DROP POLICY IF EXISTS "anon full access %1$s" ON public.%1$s', t);
    EXECUTE format('CREATE POLICY "anon full access %1$s" ON public.%1$s FOR ALL TO anon USING (true) WITH CHECK (true)', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%1$s TO anon', t);
  END LOOP;
END $$;