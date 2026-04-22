CREATE OR REPLACE FUNCTION public.gm_apply_stock_json_item(p_item jsonb, p_multiplier numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product_id text;
  v_variant_id text;
  v_quantity numeric;
BEGIN
  v_product_id := COALESCE(p_item->>'productId', p_item->>'product_id');
  v_variant_id := COALESCE(p_item->>'variantId', p_item->>'variant_id');
  v_quantity := COALESCE(NULLIF(p_item->>'quantity', '')::numeric, 0) * p_multiplier;

  IF v_product_id IS NULL OR v_product_id = '' OR v_product_id = 'cart-discount' OR v_quantity = 0 THEN
    RETURN;
  END IF;

  IF v_variant_id IS NOT NULL AND v_variant_id <> '' THEN
    UPDATE public.product_variants
    SET stock_quantity = COALESCE(stock_quantity, 0) + v_quantity,
        updated_at = now()
    WHERE id = v_variant_id::uuid;
  ELSE
    UPDATE public.products
    SET stock_quantity = COALESCE(stock_quantity, 0) + v_quantity,
        updated_at = now()
    WHERE id = v_product_id::uuid;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.gm_apply_stock_for_pos_items(p_items jsonb, p_multiplier numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item jsonb;
  v_component jsonb;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RETURN;
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    IF jsonb_typeof(v_item->'comboItems') = 'array' AND jsonb_array_length(v_item->'comboItems') > 0 THEN
      FOR v_component IN SELECT value FROM jsonb_array_elements(v_item->'comboItems')
      LOOP
        PERFORM public.gm_apply_stock_json_item(v_component, p_multiplier);
      END LOOP;
    ELSE
      PERFORM public.gm_apply_stock_json_item(v_item, p_multiplier);
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.deduct_stock_simple()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.gm_apply_stock_for_pos_items(NEW.items, -1);
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.gm_apply_stock_for_pos_items(OLD.items, 1);
    PERFORM public.gm_apply_stock_for_pos_items(NEW.items, -1);
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_stock_on_transaction_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.gm_apply_stock_for_pos_items(OLD.items, 1);
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.gm_adjust_order_item_stock(p_product_id uuid, p_quantity numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.products
  SET stock_quantity = COALESCE(stock_quantity, 0) + p_quantity,
      updated_at = now()
  WHERE id = p_product_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.gm_reconcile_delivered_order_item_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_delivered boolean := false;
  v_new_delivered boolean := false;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    SELECT status = 'delivered' INTO v_old_delivered
    FROM public.orders
    WHERE id = OLD.order_id;
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    SELECT status = 'delivered' INTO v_new_delivered
    FROM public.orders
    WHERE id = NEW.order_id;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF v_new_delivered THEN
      PERFORM public.gm_adjust_order_item_stock(NEW.product_id, -NEW.quantity);
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF v_old_delivered THEN
      PERFORM public.gm_adjust_order_item_stock(OLD.product_id, OLD.quantity);
    END IF;
    IF v_new_delivered THEN
      PERFORM public.gm_adjust_order_item_stock(NEW.product_id, -NEW.quantity);
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF v_old_delivered THEN
      PERFORM public.gm_adjust_order_item_stock(OLD.product_id, OLD.quantity);
    END IF;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS gm_reconcile_delivered_order_item_stock_trigger ON public.order_items;
CREATE TRIGGER gm_reconcile_delivered_order_item_stock_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.gm_reconcile_delivered_order_item_stock();

CREATE OR REPLACE FUNCTION public.gm_restore_stock_on_delivered_order_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item record;
BEGIN
  IF OLD.status = 'delivered' THEN
    FOR v_item IN
      SELECT product_id, quantity
      FROM public.order_items
      WHERE order_id = OLD.id
    LOOP
      PERFORM public.gm_adjust_order_item_stock(v_item.product_id, v_item.quantity);
    END LOOP;
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS gm_restore_stock_on_delivered_order_delete_trigger ON public.orders;
CREATE TRIGGER gm_restore_stock_on_delivered_order_delete_trigger
BEFORE DELETE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.gm_restore_stock_on_delivered_order_delete();