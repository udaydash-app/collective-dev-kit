
-- ============== Restaurant POS schema ==============

-- Sequence for human-readable order numbers
CREATE SEQUENCE IF NOT EXISTS public.restaurant_order_no_seq START 1000;

-- 1. Tables (floor plan)
CREATE TABLE public.restaurant_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid,
  name text NOT NULL,
  seats int NOT NULL DEFAULT 4,
  x int NOT NULL DEFAULT 0,
  y int NOT NULL DEFAULT 0,
  shape text NOT NULL DEFAULT 'square' CHECK (shape IN ('square','round')),
  status text NOT NULL DEFAULT 'free' CHECK (status IN ('free','occupied','reserved','bill')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_tables TO authenticated;
GRANT ALL ON public.restaurant_tables TO service_role;
ALTER TABLE public.restaurant_tables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth full access tables" ON public.restaurant_tables FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. Menu categories
CREATE TABLE public.restaurant_menu_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  color text DEFAULT '#f97316',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_menu_categories TO authenticated;
GRANT ALL ON public.restaurant_menu_categories TO service_role;
ALTER TABLE public.restaurant_menu_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth full access menu cat" ON public.restaurant_menu_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. Menu items
CREATE TABLE public.restaurant_menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES public.restaurant_menu_categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  price numeric(12,2) NOT NULL DEFAULT 0,
  image_url text,
  is_available boolean NOT NULL DEFAULT true,
  kot_printer text NOT NULL DEFAULT 'kitchen' CHECK (kot_printer IN ('kitchen','bar','none')),
  prep_minutes int DEFAULT 10,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_menu_items TO authenticated;
GRANT ALL ON public.restaurant_menu_items TO service_role;
ALTER TABLE public.restaurant_menu_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth full access menu items" ON public.restaurant_menu_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. Modifier groups + modifiers
CREATE TABLE public.restaurant_modifier_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  min_select int NOT NULL DEFAULT 0,
  max_select int NOT NULL DEFAULT 1,
  required boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_modifier_groups TO authenticated;
GRANT ALL ON public.restaurant_modifier_groups TO service_role;
ALTER TABLE public.restaurant_modifier_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth full access mod groups" ON public.restaurant_modifier_groups FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.restaurant_modifiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.restaurant_modifier_groups(id) ON DELETE CASCADE,
  name text NOT NULL,
  price_delta numeric(12,2) NOT NULL DEFAULT 0,
  sort_order int NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_modifiers TO authenticated;
GRANT ALL ON public.restaurant_modifiers TO service_role;
ALTER TABLE public.restaurant_modifiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth full access mods" ON public.restaurant_modifiers FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.restaurant_item_modifier_groups (
  menu_item_id uuid NOT NULL REFERENCES public.restaurant_menu_items(id) ON DELETE CASCADE,
  modifier_group_id uuid NOT NULL REFERENCES public.restaurant_modifier_groups(id) ON DELETE CASCADE,
  PRIMARY KEY (menu_item_id, modifier_group_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_item_modifier_groups TO authenticated;
GRANT ALL ON public.restaurant_item_modifier_groups TO service_role;
ALTER TABLE public.restaurant_item_modifier_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth full access item mod groups" ON public.restaurant_item_modifier_groups FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. Recipes (links to existing products for stock deduction)
CREATE TABLE public.restaurant_recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id uuid NOT NULL REFERENCES public.restaurant_menu_items(id) ON DELETE CASCADE,
  product_id uuid NOT NULL,
  quantity numeric(12,3) NOT NULL DEFAULT 1,
  unit text DEFAULT 'unit',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_recipes TO authenticated;
GRANT ALL ON public.restaurant_recipes TO service_role;
ALTER TABLE public.restaurant_recipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth full access recipes" ON public.restaurant_recipes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 6. Orders
CREATE TABLE public.restaurant_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_no text NOT NULL UNIQUE DEFAULT ('R-' || nextval('public.restaurant_order_no_seq')::text),
  type text NOT NULL DEFAULT 'dine_in' CHECK (type IN ('dine_in','takeaway','delivery')),
  table_id uuid REFERENCES public.restaurant_tables(id) ON DELETE SET NULL,
  customer_id uuid,
  customer_name text,
  customer_phone text,
  delivery_address text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','sent','served','paid','void')),
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  tax numeric(12,2) NOT NULL DEFAULT 0,
  service_charge numeric(12,2) NOT NULL DEFAULT 0,
  discount numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  notes text,
  opened_by uuid,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_orders TO authenticated;
GRANT ALL ON public.restaurant_orders TO service_role;
ALTER TABLE public.restaurant_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth full access orders" ON public.restaurant_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 7. Order items
CREATE TABLE public.restaurant_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.restaurant_orders(id) ON DELETE CASCADE,
  menu_item_id uuid REFERENCES public.restaurant_menu_items(id) ON DELETE SET NULL,
  name text NOT NULL,
  qty numeric(10,2) NOT NULL DEFAULT 1,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  modifiers jsonb DEFAULT '[]'::jsonb,
  note text,
  kot_status text NOT NULL DEFAULT 'new' CHECK (kot_status IN ('new','sent','preparing','ready','served','void')),
  kot_batch int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_order_items TO authenticated;
GRANT ALL ON public.restaurant_order_items TO service_role;
ALTER TABLE public.restaurant_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth full access order items" ON public.restaurant_order_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_rest_order_items_order ON public.restaurant_order_items(order_id);

-- 8. Payments (supports split)
CREATE TABLE public.restaurant_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.restaurant_orders(id) ON DELETE CASCADE,
  method text NOT NULL DEFAULT 'cash',
  amount numeric(12,2) NOT NULL DEFAULT 0,
  paid_by uuid,
  paid_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_payments TO authenticated;
GRANT ALL ON public.restaurant_payments TO service_role;
ALTER TABLE public.restaurant_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth full access payments" ON public.restaurant_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============== Triggers ==============

-- Touch updated_at
CREATE OR REPLACE FUNCTION public.restaurant_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER trg_rest_tables_touch BEFORE UPDATE ON public.restaurant_tables
  FOR EACH ROW EXECUTE FUNCTION public.restaurant_touch_updated_at();
CREATE TRIGGER trg_rest_items_touch BEFORE UPDATE ON public.restaurant_menu_items
  FOR EACH ROW EXECUTE FUNCTION public.restaurant_touch_updated_at();
CREATE TRIGGER trg_rest_orders_touch BEFORE UPDATE ON public.restaurant_orders
  FOR EACH ROW EXECUTE FUNCTION public.restaurant_touch_updated_at();

-- On paid: deduct recipe stock from products
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
        SELECT product_id, quantity FROM public.restaurant_recipes
        WHERE menu_item_id = it.menu_item_id
      LOOP
        UPDATE public.products
          SET stock = COALESCE(stock,0) - (r.quantity * it.qty)
          WHERE id = r.product_id;
      END LOOP;
    END LOOP;

    -- Free table
    IF NEW.table_id IS NOT NULL THEN
      UPDATE public.restaurant_tables SET status = 'free' WHERE id = NEW.table_id;
    END IF;

    NEW.closed_at := now();
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_rest_order_paid
  BEFORE UPDATE OF status ON public.restaurant_orders
  FOR EACH ROW EXECUTE FUNCTION public.restaurant_on_order_paid();

-- When order created with table, mark table occupied
CREATE OR REPLACE FUNCTION public.restaurant_on_order_open()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.table_id IS NOT NULL AND NEW.status = 'open' THEN
    UPDATE public.restaurant_tables SET status = 'occupied' WHERE id = NEW.table_id;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_rest_order_open
  AFTER INSERT ON public.restaurant_orders
  FOR EACH ROW EXECUTE FUNCTION public.restaurant_on_order_open();

-- Recalculate totals when items change
CREATE OR REPLACE FUNCTION public.restaurant_recalc_order_totals()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  oid uuid;
  sub numeric;
BEGIN
  oid := COALESCE(NEW.order_id, OLD.order_id);
  SELECT COALESCE(SUM(qty * unit_price), 0) INTO sub
    FROM public.restaurant_order_items
    WHERE order_id = oid AND kot_status <> 'void';
  UPDATE public.restaurant_orders
    SET subtotal = sub,
        total = sub + tax + service_charge - discount
    WHERE id = oid;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_rest_items_recalc
  AFTER INSERT OR UPDATE OR DELETE ON public.restaurant_order_items
  FOR EACH ROW EXECUTE FUNCTION public.restaurant_recalc_order_totals();
