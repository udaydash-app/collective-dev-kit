
-- Restaurant ingredient inventory
CREATE TABLE public.restaurant_ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  unit text NOT NULL DEFAULT 'unit',
  stock numeric NOT NULL DEFAULT 0,
  avg_cost numeric NOT NULL DEFAULT 0,
  last_cost numeric NOT NULL DEFAULT 0,
  min_stock numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_ingredients TO anon, authenticated;
GRANT ALL ON public.restaurant_ingredients TO service_role;
ALTER TABLE public.restaurant_ingredients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon full ingredients" ON public.restaurant_ingredients FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "auth full ingredients" ON public.restaurant_ingredients FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE UNIQUE INDEX idx_rest_ing_name_lower ON public.restaurant_ingredients (lower(name));

-- Restaurant purchases (header)
CREATE TABLE public.restaurant_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_no text NOT NULL DEFAULT ('PUR-' || to_char(now(), 'YYYYMMDDHH24MISS')),
  supplier_name text,
  notes text,
  total numeric NOT NULL DEFAULT 0,
  purchase_date timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_purchases TO anon, authenticated;
GRANT ALL ON public.restaurant_purchases TO service_role;
ALTER TABLE public.restaurant_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon full rest_purchases" ON public.restaurant_purchases FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "auth full rest_purchases" ON public.restaurant_purchases FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Restaurant purchase items
CREATE TABLE public.restaurant_purchase_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL REFERENCES public.restaurant_purchases(id) ON DELETE CASCADE,
  ingredient_id uuid NOT NULL REFERENCES public.restaurant_ingredients(id),
  quantity numeric NOT NULL,
  unit_cost numeric NOT NULL,
  total numeric GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_purchase_items TO anon, authenticated;
GRANT ALL ON public.restaurant_purchase_items TO service_role;
ALTER TABLE public.restaurant_purchase_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon full rest_purchase_items" ON public.restaurant_purchase_items FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "auth full rest_purchase_items" ON public.restaurant_purchase_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_rest_pi_purchase ON public.restaurant_purchase_items(purchase_id);
CREATE INDEX idx_rest_pi_ingredient ON public.restaurant_purchase_items(ingredient_id);

-- Add ingredient_id to recipes (nullable, keep existing product_id)
ALTER TABLE public.restaurant_recipes ADD COLUMN IF NOT EXISTS ingredient_id uuid REFERENCES public.restaurant_ingredients(id) ON DELETE CASCADE;
ALTER TABLE public.restaurant_recipes ALTER COLUMN product_id DROP NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rest_recipes_ingredient ON public.restaurant_recipes(ingredient_id);

-- Trigger: on purchase item insert -> add stock + weighted avg cost
CREATE OR REPLACE FUNCTION public.restaurant_purchase_item_apply()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cur_stock numeric;
  cur_avg numeric;
  new_stock numeric;
  new_avg numeric;
BEGIN
  SELECT stock, avg_cost INTO cur_stock, cur_avg FROM public.restaurant_ingredients WHERE id = NEW.ingredient_id FOR UPDATE;
  cur_stock := COALESCE(cur_stock, 0);
  cur_avg := COALESCE(cur_avg, 0);
  new_stock := cur_stock + NEW.quantity;
  IF new_stock > 0 THEN
    new_avg := ((GREATEST(cur_stock,0) * cur_avg) + (NEW.quantity * NEW.unit_cost)) / new_stock;
  ELSE
    new_avg := NEW.unit_cost;
  END IF;
  UPDATE public.restaurant_ingredients
    SET stock = new_stock,
        avg_cost = new_avg,
        last_cost = NEW.unit_cost,
        updated_at = now()
    WHERE id = NEW.ingredient_id;

  -- update purchase header total
  UPDATE public.restaurant_purchases
    SET total = (SELECT COALESCE(SUM(total),0) FROM public.restaurant_purchase_items WHERE purchase_id = NEW.purchase_id)
    WHERE id = NEW.purchase_id;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_rest_purchase_item_apply ON public.restaurant_purchase_items;
CREATE TRIGGER trg_rest_purchase_item_apply
  AFTER INSERT ON public.restaurant_purchase_items
  FOR EACH ROW EXECUTE FUNCTION public.restaurant_purchase_item_apply();

-- Replace order-paid trigger to deduct from restaurant_ingredients (correct table)
CREATE OR REPLACE FUNCTION public.restaurant_on_order_paid()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
        SELECT ingredient_id, quantity FROM public.restaurant_recipes
        WHERE menu_item_id = it.menu_item_id AND ingredient_id IS NOT NULL
      LOOP
        UPDATE public.restaurant_ingredients
          SET stock = COALESCE(stock,0) - (r.quantity * it.qty),
              updated_at = now()
          WHERE id = r.ingredient_id;
      END LOOP;
    END LOOP;

    IF NEW.table_id IS NOT NULL THEN
      UPDATE public.restaurant_tables SET status = 'free' WHERE id = NEW.table_id;
    END IF;
    NEW.closed_at := now();
  END IF;
  RETURN NEW;
END $$;

-- Helper: cost of menu item
CREATE OR REPLACE FUNCTION public.restaurant_menu_item_cost(p_menu_item_id uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(r.quantity * COALESCE(i.avg_cost, 0)), 0)
  FROM public.restaurant_recipes r
  JOIN public.restaurant_ingredients i ON i.id = r.ingredient_id
  WHERE r.menu_item_id = p_menu_item_id;
$$;
GRANT EXECUTE ON FUNCTION public.restaurant_menu_item_cost(uuid) TO anon, authenticated;
