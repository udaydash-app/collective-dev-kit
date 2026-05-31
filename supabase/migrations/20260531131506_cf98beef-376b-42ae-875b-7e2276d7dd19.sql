GRANT SELECT ON public.restaurant_tables TO anon;
GRANT SELECT ON public.restaurant_menu_categories TO anon;
GRANT SELECT ON public.restaurant_menu_items TO anon;
GRANT SELECT ON public.restaurant_modifier_groups TO anon;
GRANT SELECT ON public.restaurant_modifiers TO anon;
GRANT SELECT ON public.restaurant_item_modifier_groups TO anon;
GRANT SELECT ON public.restaurant_recipes TO anon;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='restaurant_tables' AND policyname='anon can view restaurant tables') THEN
    CREATE POLICY "anon can view restaurant tables" ON public.restaurant_tables FOR SELECT TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='restaurant_menu_categories' AND policyname='anon can view restaurant menu categories') THEN
    CREATE POLICY "anon can view restaurant menu categories" ON public.restaurant_menu_categories FOR SELECT TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='restaurant_menu_items' AND policyname='anon can view restaurant menu items') THEN
    CREATE POLICY "anon can view restaurant menu items" ON public.restaurant_menu_items FOR SELECT TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='restaurant_modifier_groups' AND policyname='anon can view restaurant modifier groups') THEN
    CREATE POLICY "anon can view restaurant modifier groups" ON public.restaurant_modifier_groups FOR SELECT TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='restaurant_modifiers' AND policyname='anon can view restaurant modifiers') THEN
    CREATE POLICY "anon can view restaurant modifiers" ON public.restaurant_modifiers FOR SELECT TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='restaurant_item_modifier_groups' AND policyname='anon can view restaurant item modifier groups') THEN
    CREATE POLICY "anon can view restaurant item modifier groups" ON public.restaurant_item_modifier_groups FOR SELECT TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='restaurant_recipes' AND policyname='anon can view restaurant recipes') THEN
    CREATE POLICY "anon can view restaurant recipes" ON public.restaurant_recipes FOR SELECT TO anon USING (true);
  END IF;
END $$;

WITH sample_products AS (
  SELECT id, name, row_number() OVER (ORDER BY name) AS rn
  FROM public.products
  WHERE id IS NOT NULL
  ORDER BY name
  LIMIT 12
), sample_items AS (
  SELECT id, name, row_number() OVER (ORDER BY sort_order, name) AS rn
  FROM public.restaurant_menu_items
  WHERE name IN ('Spring Rolls','Chicken Wings','Grilled Chicken','Pasta Alfredo','Margherita','Classic Burger','Coca-Cola','Chocolate Cake')
)
INSERT INTO public.restaurant_recipes (menu_item_id, product_id, quantity, unit)
SELECT si.id, sp.id,
  CASE WHEN si.rn % 3 = 0 THEN 0.250 WHEN si.rn % 3 = 1 THEN 1 ELSE 0.500 END,
  CASE WHEN si.rn % 3 = 0 THEN 'kg' WHEN si.rn % 3 = 1 THEN 'pcs' ELSE 'unit' END
FROM sample_items si
JOIN sample_products sp ON sp.rn = ((si.rn - 1) % 12) + 1
WHERE NOT EXISTS (
  SELECT 1 FROM public.restaurant_recipes rr
  WHERE rr.menu_item_id = si.id AND rr.product_id = sp.id
);

CREATE OR REPLACE FUNCTION public.restaurant_on_order_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  it record;
  r record;
BEGIN
  IF NEW.status = 'paid' AND (OLD.status IS DISTINCT FROM 'paid') THEN
    FOR it IN
      SELECT menu_item_id, qty FROM public.restaurant_order_items
      WHERE order_id = NEW.id AND kot_status <> 'void'
    LOOP
      FOR r IN
        SELECT product_id, quantity FROM public.restaurant_recipes
        WHERE menu_item_id = it.menu_item_id
      LOOP
        UPDATE public.products
          SET stock_quantity = FLOOR(COALESCE(stock_quantity, 0) - (r.quantity * it.qty))::integer
          WHERE id = r.product_id;
      END LOOP;
    END LOOP;

    IF NEW.table_id IS NOT NULL THEN
      UPDATE public.restaurant_tables SET status = 'free' WHERE id = NEW.table_id;
    END IF;

    NEW.closed_at := now();
  END IF;
  RETURN NEW;
END $$;