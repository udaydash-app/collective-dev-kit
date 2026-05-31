
CREATE POLICY "anon full access restaurant_orders" ON public.restaurant_orders FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon full access restaurant_order_items" ON public.restaurant_order_items FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_orders TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_order_items TO anon;
