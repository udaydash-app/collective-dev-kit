
-- 1. pos_todos: lock down to admin/cashier
DROP POLICY IF EXISTS "Anyone can view pos todos" ON public.pos_todos;
DROP POLICY IF EXISTS "Anyone can insert pos todos" ON public.pos_todos;
DROP POLICY IF EXISTS "Anyone can update pos todos" ON public.pos_todos;
DROP POLICY IF EXISTS "Anyone can delete pos todos" ON public.pos_todos;

CREATE POLICY "Staff can view pos todos" ON public.pos_todos
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'cashier'));
CREATE POLICY "Staff can insert pos todos" ON public.pos_todos
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'cashier'));
CREATE POLICY "Staff can update pos todos" ON public.pos_todos
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'cashier'));
CREATE POLICY "Staff can delete pos todos" ON public.pos_todos
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'cashier'));

-- 2. purchase_orders / purchase_order_items: remove broad share_token policies
DROP POLICY IF EXISTS "Anyone can view purchase orders via share token" ON public.purchase_orders;
DROP POLICY IF EXISTS "Anyone can view purchase order items via share token" ON public.purchase_order_items;

-- Provide a SECURITY DEFINER function that requires the exact token
CREATE OR REPLACE FUNCTION public.get_purchase_order_by_share_token(_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF _token IS NULL OR length(_token) < 16 THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'order', to_jsonb(po.*),
    'items', COALESCE((
      SELECT jsonb_agg(
        to_jsonb(poi.*)
        || jsonb_build_object(
          'products', to_jsonb(p.*),
          'product_variants', to_jsonb(pv.*)
        )
      )
      FROM public.purchase_order_items poi
      LEFT JOIN public.products p ON p.id = poi.product_id
      LEFT JOIN public.product_variants pv ON pv.id = poi.variant_id
      WHERE poi.purchase_order_id = po.id
    ), '[]'::jsonb)
  )
  INTO result
  FROM public.purchase_orders po
  WHERE po.share_token = _token;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_purchase_order_by_share_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_purchase_order_by_share_token(text) TO anon, authenticated;

-- Function for fetching existing responses by token (used by quote form)
CREATE OR REPLACE FUNCTION public.get_po_responses_by_share_token(_token text)
RETURNS SETOF public.purchase_order_responses
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _token IS NULL OR length(_token) < 16 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT r.*
  FROM public.purchase_order_responses r
  JOIN public.purchase_orders po ON po.id = r.purchase_order_id
  WHERE po.share_token = _token;
END;
$$;

REVOKE ALL ON FUNCTION public.get_po_responses_by_share_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_po_responses_by_share_token(text) TO anon, authenticated;

-- 3. chat_messages: drop policies that include `user_id IS NULL`
DROP POLICY IF EXISTS "Users can send messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can view messages" ON public.chat_messages;
-- The remaining policies (admin/cashier + owner-scoped) cover all valid access.

-- 4. user_roles: remove self cashier escalation
DROP POLICY IF EXISTS "Users can create their own cashier role" ON public.user_roles;

-- 5. order_items: drop overly permissive insert
DROP POLICY IF EXISTS "Allow order items insertion" ON public.order_items;

-- 6. multi_product_bogo offers/items: restrict mutations to admin/cashier
DROP POLICY IF EXISTS "Allow authenticated users to manage multi_product_bogo_items" ON public.multi_product_bogo_items;
DROP POLICY IF EXISTS "Allow authenticated users to manage multi_product_bogo_offers" ON public.multi_product_bogo_offers;

CREATE POLICY "Staff can manage multi_product_bogo_offers" ON public.multi_product_bogo_offers
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'cashier'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'cashier'));

CREATE POLICY "Staff can manage multi_product_bogo_items" ON public.multi_product_bogo_items
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'cashier'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'cashier'));

-- 7. purchase_order_responses: drop anon insert; edge function uses service role
DROP POLICY IF EXISTS "Anyone can insert PO responses" ON public.purchase_order_responses;
