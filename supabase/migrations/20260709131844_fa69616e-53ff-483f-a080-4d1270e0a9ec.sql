CREATE OR REPLACE FUNCTION public.get_product_profit_report(
  input_pos_user_id uuid,
  input_pin text,
  start_ts timestamp with time zone DEFAULT NULL::timestamp with time zone,
  end_ts timestamp with time zone DEFAULT NULL::timestamp with time zone,
  store_filter uuid DEFAULT NULL::uuid,
  category_filter uuid DEFAULT NULL::uuid
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
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.pos_users pu
    WHERE pu.id = input_pos_user_id
      AND pu.pin_hash = extensions.crypt(input_pin, pu.pin_hash)
      AND pu.is_active = true
      AND lower(trim(COALESCE(pu.role, ''))) IN ('admin', 'cashier')
  ) THEN
    RAISE EXCEPTION 'Admin or cashier PIN required';
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
$function$;