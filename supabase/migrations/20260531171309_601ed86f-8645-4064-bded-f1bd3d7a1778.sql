DROP POLICY IF EXISTS "anon can view restaurant recipes" ON public.restaurant_recipes;
CREATE POLICY "anon full access recipes" ON public.restaurant_recipes FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT INSERT, UPDATE, DELETE ON public.restaurant_recipes TO anon;