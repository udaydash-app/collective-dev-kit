CREATE OR REPLACE FUNCTION public.verify_admin_pin_session(input_pos_user_id uuid, input_pin text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.pos_users pu
    WHERE pu.id = input_pos_user_id
      AND pu.pin_hash = extensions.crypt(input_pin, pu.pin_hash)
      AND pu.is_active = true
      AND lower(trim(pu.full_name)) = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.verify_admin_pin_session(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_admin_pin_session(uuid, text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_classic_dashboard_stats(
  input_pos_user_id uuid,
  input_pin text,
  start_ts timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.verify_admin_pin_session(input_pos_user_id, input_pin) THEN
    RAISE EXCEPTION 'Admin PIN required';
  END IF;

  SELECT jsonb_build_object(
    'revenue',
      COALESCE((SELECT SUM(total) FROM public.orders WHERE created_at >= start_ts), 0)
      + COALESCE((SELECT SUM(total) FROM public.pos_transactions WHERE created_at >= start_ts), 0),
    'orders', (SELECT COUNT(*) FROM public.orders WHERE created_at >= start_ts),
    'posTransactions', (SELECT COUNT(*) FROM public.pos_transactions WHERE created_at >= start_ts),
    'totalTransactions',
      (SELECT COUNT(*) FROM public.orders WHERE created_at >= start_ts)
      + (SELECT COUNT(*) FROM public.pos_transactions WHERE created_at >= start_ts),
    'pendingOrders', (SELECT COUNT(*) FROM public.orders WHERE created_at >= start_ts AND status = 'pending'),
    'totalProducts', (SELECT COUNT(*) FROM public.products),
    'totalUsers', (SELECT COUNT(*) FROM public.profiles),
    'recentOrders', COALESCE((
      SELECT jsonb_agg(to_jsonb(o) ORDER BY o.created_at DESC)
      FROM (
        SELECT id, order_number, total, status, created_at
        FROM public.orders
        WHERE created_at >= start_ts
        ORDER BY created_at DESC
        LIMIT 5
      ) o
    ), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_classic_dashboard_stats(uuid, text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_classic_dashboard_stats(uuid, text, timestamptz) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_admin_analytics(
  input_pos_user_id uuid,
  input_pin text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  thirty_days_ago timestamptz := now() - interval '30 days';
  result jsonb;
BEGIN
  IF NOT public.verify_admin_pin_session(input_pos_user_id, input_pin) THEN
    RAISE EXCEPTION 'Admin PIN required';
  END IF;

  SELECT jsonb_build_object(
    'summary', jsonb_build_object(
      'totalEvents', (SELECT COUNT(*) FROM public.analytics_events),
      'totalOrders', (SELECT COUNT(*) FROM public.pos_transactions),
      'totalRevenue', COALESCE((SELECT SUM(total) FROM public.pos_transactions), 0),
      'activeUsers', (
        SELECT COUNT(DISTINCT user_id)
        FROM public.analytics_events
        WHERE created_at >= thirty_days_ago AND user_id IS NOT NULL
      )
    ),
    'eventData', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('event_type', event_type, 'count', event_count) ORDER BY event_count DESC)
      FROM (
        SELECT event_type, COUNT(*) AS event_count
        FROM public.analytics_events
        GROUP BY event_type
      ) events
    ), '[]'::jsonb),
    'importLogs', COALESCE((
      SELECT jsonb_agg(to_jsonb(l) ORDER BY l.created_at DESC)
      FROM (
        SELECT id, url, status, products_imported, error_message, execution_time_ms, created_at
        FROM public.import_logs
        ORDER BY created_at DESC
        LIMIT 10
      ) l
    ), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_analytics(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_analytics(uuid, text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_product_profit_report(
  input_pos_user_id uuid,
  input_pin text,
  start_ts timestamptz DEFAULT NULL,
  end_ts timestamptz DEFAULT NULL,
  store_filter uuid DEFAULT NULL,
  category_filter uuid DEFAULT NULL
)
RETURNS TABLE(
  product_id uuid,
  product_name text,
  category_id uuid,
  category_name text,
  units_sold numeric,
  total_revenue numeric,
  total_cogs numeric,
  gross_profit numeric,
  profit_margin numeric,
  avg_selling_price numeric,
  avg_cost numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.verify_admin_pin_session(input_pos_user_id, input_pin) THEN
    RAISE EXCEPTION 'Admin PIN required';
  END IF;

  RETURN QUERY
  WITH expanded AS (
    SELECT
      t.store_id,
      t.created_at,
      item.value AS item,
      COALESCE(item.value->>'productId', item.value->>'product_id', item.value->>'id') AS product_id_text,
      ABS(COALESCE(NULLIF(item.value->>'quantity', '')::numeric, 0)) AS quantity,
      COALESCE(NULLIF(item.value->>'customPrice', '')::numeric, NULLIF(item.value->>'price', '')::numeric, NULLIF(item.value->>'unit_price', '')::numeric, 0) AS unit_price,
      COALESCE(NULLIF(item.value->>'itemDiscount', '')::numeric, NULLIF(item.value->>'discount', '')::numeric, 0) AS item_discount
    FROM public.pos_transactions t
    CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(t.items) = 'array' THEN t.items ELSE '[]'::jsonb END) item(value)
    WHERE (start_ts IS NULL OR t.created_at >= start_ts)
      AND (end_ts IS NULL OR t.created_at <= end_ts)
      AND (store_filter IS NULL OR t.store_id = store_filter)
  ), normalized AS (
    SELECT
      product_id_text::uuid AS product_id,
      store_id,
      quantity,
      GREATEST(unit_price - item_discount, 0) * quantity AS revenue
    FROM expanded
    WHERE product_id_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ), joined AS (
    SELECT
      p.id AS product_id,
      p.name AS product_name,
      p.category_id,
      COALESCE(c.name, 'Uncategorized') AS category_name,
      n.quantity,
      n.revenue,
      (COALESCE(p.cost_price, 0) + COALESCE(p.local_charges, 0)) * n.quantity AS cogs
    FROM normalized n
    JOIN public.products p ON p.id = n.product_id
    LEFT JOIN public.categories c ON c.id = p.category_id
    WHERE (category_filter IS NULL OR p.category_id = category_filter)
      AND (store_filter IS NULL OR p.store_id = store_filter)
  ), grouped AS (
    SELECT
      joined.product_id,
      joined.product_name,
      joined.category_id,
      joined.category_name,
      SUM(joined.quantity) AS units_sold,
      SUM(joined.revenue) AS total_revenue,
      SUM(joined.cogs) AS total_cogs
    FROM joined
    GROUP BY joined.product_id, joined.product_name, joined.category_id, joined.category_name
  )
  SELECT
    grouped.product_id,
    grouped.product_name,
    grouped.category_id,
    grouped.category_name,
    grouped.units_sold,
    grouped.total_revenue,
    grouped.total_cogs,
    grouped.total_revenue - grouped.total_cogs AS gross_profit,
    CASE WHEN grouped.total_revenue > 0 THEN ((grouped.total_revenue - grouped.total_cogs) / grouped.total_revenue) * 100 ELSE 0 END AS profit_margin,
    CASE WHEN grouped.units_sold > 0 THEN grouped.total_revenue / grouped.units_sold ELSE 0 END AS avg_selling_price,
    CASE WHEN grouped.units_sold > 0 THEN grouped.total_cogs / grouped.units_sold ELSE 0 END AS avg_cost
  FROM grouped
  ORDER BY grouped.total_revenue DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_product_profit_report(uuid, text, timestamptz, timestamptz, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_product_profit_report(uuid, text, timestamptz, timestamptz, uuid, uuid) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_profit_loss_group_report(
  input_pos_user_id uuid,
  input_pin text,
  group_by text,
  start_ts timestamptz,
  end_ts timestamptz
)
RETURNS TABLE(
  key text,
  label text,
  sales numeric,
  cost numeric,
  profit numeric,
  margin numeric,
  units numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.verify_admin_pin_session(input_pos_user_id, input_pin) THEN
    RAISE EXCEPTION 'Admin PIN required';
  END IF;

  RETURN QUERY
  WITH expanded AS (
    SELECT
      t.customer_id,
      t.created_at,
      item.value AS item,
      COALESCE(item.value->>'productId', item.value->>'product_id', item.value->>'id') AS product_id_text,
      ABS(COALESCE(NULLIF(item.value->>'quantity', '')::numeric, 1)) AS quantity,
      COALESCE(NULLIF(item.value->>'customPrice', '')::numeric, NULLIF(item.value->>'price', '')::numeric, NULLIF(item.value->>'unit_price', '')::numeric, 0) AS unit_price,
      COALESCE(NULLIF(item.value->>'itemDiscount', '')::numeric, NULLIF(item.value->>'discount', '')::numeric, 0) AS item_discount
    FROM public.pos_transactions t
    CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(t.items) = 'array' THEN t.items ELSE '[]'::jsonb END) item(value)
    WHERE t.created_at >= start_ts
      AND t.created_at <= end_ts
  ), normalized AS (
    SELECT
      customer_id,
      created_at,
      CASE WHEN product_id_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN product_id_text::uuid ELSE NULL END AS product_id,
      quantity,
      GREATEST(unit_price - item_discount, 0) * quantity AS sale
    FROM expanded
  ), enriched AS (
    SELECT
      CASE
        WHEN group_by = 'month' THEN to_char(n.created_at, 'YYYY-MM')
        WHEN group_by = 'year' THEN to_char(n.created_at, 'YYYY')
        ELSE COALESCE(n.customer_id::text, 'walkin')
      END AS group_key,
      CASE
        WHEN group_by = 'month' THEN to_char(n.created_at, 'FMMonth YYYY')
        WHEN group_by = 'year' THEN to_char(n.created_at, 'YYYY')
        ELSE COALESCE(c.name, 'Walk-in Customer')
      END AS group_label,
      n.quantity,
      n.sale,
      (COALESCE(p.cost_price, 0) + COALESCE(p.local_charges, 0)) * n.quantity AS item_cost
    FROM normalized n
    LEFT JOIN public.products p ON p.id = n.product_id
    LEFT JOIN public.contacts c ON c.id = n.customer_id
  ), grouped AS (
    SELECT
      group_key,
      group_label,
      SUM(sale) AS sales,
      SUM(item_cost) AS cost,
      SUM(quantity) AS units
    FROM enriched
    GROUP BY group_key, group_label
  )
  SELECT
    grouped.group_key AS key,
    grouped.group_label AS label,
    grouped.sales,
    grouped.cost,
    grouped.sales - grouped.cost AS profit,
    CASE WHEN grouped.sales > 0 THEN ((grouped.sales - grouped.cost) / grouped.sales) * 100 ELSE 0 END AS margin,
    grouped.units
  FROM grouped
  ORDER BY
    CASE WHEN group_by = 'customer' THEN grouped.sales END DESC,
    grouped.group_key ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_profit_loss_group_report(uuid, text, text, timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_profit_loss_group_report(uuid, text, text, timestamptz, timestamptz) TO anon, authenticated, service_role;