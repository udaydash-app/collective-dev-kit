CREATE OR REPLACE VIEW public.restaurant_table_activity AS
SELECT
  ro.table_id,
  ro.id AS order_id,
  ro.order_no,
  ro.status AS order_status,
  ro.total,
  COALESCE(COUNT(roi.id), 0)::integer AS item_count,
  MAX(roi.created_at) AS last_item_at
FROM public.restaurant_orders ro
LEFT JOIN public.restaurant_order_items roi ON roi.order_id = ro.id AND roi.kot_status <> 'void'
WHERE ro.table_id IS NOT NULL
  AND ro.status IN ('open', 'sent', 'served')
GROUP BY ro.table_id, ro.id, ro.order_no, ro.status, ro.total;

GRANT SELECT ON public.restaurant_table_activity TO anon;
GRANT SELECT ON public.restaurant_table_activity TO authenticated;
GRANT SELECT ON public.restaurant_table_activity TO service_role;