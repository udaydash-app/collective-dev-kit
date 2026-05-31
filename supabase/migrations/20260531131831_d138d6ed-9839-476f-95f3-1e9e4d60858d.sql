DO $$
DECLARE
  t2 uuid;
  t4 uuid;
  order_one uuid;
  order_two uuid;
  wings uuid;
  pasta uuid;
  cola uuid;
  steak uuid;
  water uuid;
BEGIN
  SELECT id INTO t2 FROM public.restaurant_tables WHERE name = 'T2' LIMIT 1;
  SELECT id INTO t4 FROM public.restaurant_tables WHERE name = 'T4' LIMIT 1;
  SELECT id INTO wings FROM public.restaurant_menu_items WHERE name = 'Chicken Wings' LIMIT 1;
  SELECT id INTO pasta FROM public.restaurant_menu_items WHERE name = 'Pasta Alfredo' LIMIT 1;
  SELECT id INTO cola FROM public.restaurant_menu_items WHERE name = 'Coca-Cola' LIMIT 1;
  SELECT id INTO steak FROM public.restaurant_menu_items WHERE name = 'Beef Steak' LIMIT 1;
  SELECT id INTO water FROM public.restaurant_menu_items WHERE name = 'Mineral Water' LIMIT 1;

  IF t2 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.restaurant_orders WHERE table_id = t2 AND status IN ('open','sent','served')) THEN
    INSERT INTO public.restaurant_orders (type, table_id, status, notes)
    VALUES ('dine_in', t2, 'sent', 'Demo running table')
    RETURNING id INTO order_one;

    IF wings IS NOT NULL THEN
      INSERT INTO public.restaurant_order_items (order_id, menu_item_id, name, qty, unit_price, kot_status, kot_batch)
      SELECT order_one, id, name, 2, price, 'sent', 1 FROM public.restaurant_menu_items WHERE id = wings;
    END IF;
    IF pasta IS NOT NULL THEN
      INSERT INTO public.restaurant_order_items (order_id, menu_item_id, name, qty, unit_price, kot_status, kot_batch)
      SELECT order_one, id, name, 1, price, 'sent', 1 FROM public.restaurant_menu_items WHERE id = pasta;
    END IF;
    IF cola IS NOT NULL THEN
      INSERT INTO public.restaurant_order_items (order_id, menu_item_id, name, qty, unit_price, kot_status, kot_batch)
      SELECT order_one, id, name, 2, price, 'sent', 1 FROM public.restaurant_menu_items WHERE id = cola;
    END IF;
    UPDATE public.restaurant_tables SET status = 'occupied' WHERE id = t2;
  END IF;

  IF t4 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.restaurant_orders WHERE table_id = t4 AND status IN ('open','sent','served')) THEN
    INSERT INTO public.restaurant_orders (type, table_id, status, notes)
    VALUES ('dine_in', t4, 'served', 'Demo bill requested')
    RETURNING id INTO order_two;

    IF steak IS NOT NULL THEN
      INSERT INTO public.restaurant_order_items (order_id, menu_item_id, name, qty, unit_price, kot_status, kot_batch)
      SELECT order_two, id, name, 1, price, 'served', 1 FROM public.restaurant_menu_items WHERE id = steak;
    END IF;
    IF water IS NOT NULL THEN
      INSERT INTO public.restaurant_order_items (order_id, menu_item_id, name, qty, unit_price, kot_status, kot_batch)
      SELECT order_two, id, name, 2, price, 'served', 1 FROM public.restaurant_menu_items WHERE id = water;
    END IF;
    UPDATE public.restaurant_tables SET status = 'bill' WHERE id = t4;
  END IF;
END $$;