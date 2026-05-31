DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'restaurant_tables','restaurant_menu_categories','restaurant_menu_items',
    'restaurant_modifier_groups','restaurant_modifiers','restaurant_item_modifier_groups',
    'restaurant_recipes','restaurant_orders','restaurant_order_items','restaurant_payments'
  ] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;