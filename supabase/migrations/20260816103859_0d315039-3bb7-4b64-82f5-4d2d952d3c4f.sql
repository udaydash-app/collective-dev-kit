CREATE OR REPLACE FUNCTION public.get_fne_transactions(
  input_pos_user_id uuid,
  input_pin text,
  store_filter uuid DEFAULT NULL,
  start_ts timestamptz DEFAULT NULL,
  end_ts timestamptz DEFAULT NULL
)
RETURNS TABLE(id uuid, transaction_number text, created_at timestamptz, total numeric, items jsonb, customer_id uuid, customer_name text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.pos_users pu
    JOIN public.user_roles ur ON ur.user_id = pu.user_id
    WHERE pu.id = input_pos_user_id
      AND pu.pin_hash = extensions.crypt(input_pin, pu.pin_hash)
      AND pu.is_active = true
      AND ur.role IN ('admin'::public.app_role, 'cashier'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Admin or cashier PIN required';
  END IF;

  RETURN QUERY
  SELECT t.id, t.transaction_number, t.created_at, t.total, t.items, t.customer_id, c.name
  FROM public.pos_transactions t
  LEFT JOIN public.contacts c ON c.id = t.customer_id
  WHERE (store_filter IS NULL OR t.store_id = store_filter)
    AND (start_ts IS NULL OR t.created_at >= start_ts)
    AND (end_ts IS NULL OR t.created_at <= end_ts)
  ORDER BY t.created_at ASC;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_fne_transactions(uuid, text, uuid, timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_fne_transactions(uuid, text, uuid, timestamptz, timestamptz) TO authenticated, service_role;