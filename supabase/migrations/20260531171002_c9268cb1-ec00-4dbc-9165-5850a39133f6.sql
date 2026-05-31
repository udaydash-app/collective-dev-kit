GRANT SELECT ON public.restaurant_recipes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_recipes TO authenticated;
GRANT ALL ON public.restaurant_recipes TO service_role;

GRANT SELECT ON public.restaurant_ingredients TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_ingredients TO authenticated;
GRANT ALL ON public.restaurant_ingredients TO service_role;

GRANT SELECT ON public.restaurant_purchases TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_purchases TO authenticated;
GRANT ALL ON public.restaurant_purchases TO service_role;

GRANT SELECT ON public.restaurant_purchase_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_purchase_items TO authenticated;
GRANT ALL ON public.restaurant_purchase_items TO service_role;