CREATE OR REPLACE FUNCTION public.get_modern_dashboard_data(input_pos_user_id uuid, input_pin text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  verified_name text;
  since_ts timestamptz := date_trunc('day', now() - interval '13 days');
  result jsonb;
BEGIN
  SELECT pu.full_name
  INTO verified_name
  FROM public.pos_users pu
  WHERE pu.id = input_pos_user_id
    AND pu.pin_hash = crypt(input_pin, pu.pin_hash)
    AND pu.is_active = true;

  IF verified_name IS NULL THEN
    RAISE EXCEPTION 'Invalid POS session';
  END IF;

  IF lower(trim(verified_name)) <> 'admin' THEN
    RAISE EXCEPTION 'Admin PIN required';
  END IF;

  SELECT jsonb_build_object(
    'pos_transactions', COALESCE((
      SELECT jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC)
      FROM (
        SELECT id, transaction_number, total, subtotal, discount, tax, payment_method, created_at, items, cashier_id
        FROM public.pos_transactions
        WHERE created_at >= since_ts
        ORDER BY created_at DESC
        LIMIT 500
      ) t
    ), '[]'::jsonb),
    'orders', COALESCE((
      SELECT jsonb_agg(to_jsonb(o) ORDER BY o.created_at DESC)
      FROM (
        SELECT id, order_number, total, status, payment_status, created_at
        FROM public.orders
        WHERE created_at >= since_ts
        ORDER BY created_at DESC
        LIMIT 200
      ) o
    ), '[]'::jsonb),
    'purchases', COALESCE((
      SELECT jsonb_agg(to_jsonb(p) ORDER BY p.created_at DESC)
      FROM (
        SELECT id, purchase_number, supplier_name, total_amount, created_at
        FROM public.purchases
        WHERE created_at >= since_ts
        ORDER BY created_at DESC
        LIMIT 50
      ) p
    ), '[]'::jsonb),
    'expenses', COALESCE((
      SELECT jsonb_agg(to_jsonb(e) ORDER BY e.created_at DESC)
      FROM (
        SELECT id, description, category, amount, expense_date, created_at
        FROM public.expenses
        WHERE created_at >= since_ts
        ORDER BY created_at DESC
        LIMIT 50
      ) e
    ), '[]'::jsonb),
    'journal_entries', COALESCE((
      SELECT jsonb_agg(to_jsonb(j) ORDER BY j.created_at DESC)
      FROM (
        SELECT id, entry_number, reference, description, entry_date, status, created_at
        FROM public.journal_entries
        WHERE created_at >= since_ts
        ORDER BY created_at DESC
        LIMIT 50
      ) j
    ), '[]'::jsonb),
    'accounts', COALESCE((
      SELECT jsonb_agg(to_jsonb(a) ORDER BY a.account_code ASC)
      FROM (
        SELECT id, account_code, account_name, account_type, current_balance
        FROM public.accounts
        WHERE is_active = true
        ORDER BY account_code ASC
        LIMIT 500
      ) a
    ), '[]'::jsonb),
    'pos_users', COALESCE((
      SELECT jsonb_agg(to_jsonb(u) ORDER BY u.full_name ASC)
      FROM (
        SELECT id, full_name, is_active
        FROM public.pos_users
      ) u
    ), '[]'::jsonb),
    'counts', jsonb_build_object(
      'products', (SELECT count(*) FROM public.products),
      'contacts', (SELECT count(*) FROM public.contacts),
      'lowStock', (SELECT count(*) FROM public.products WHERE stock_quantity <= 5)
    )
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_modern_dashboard_data(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_modern_dashboard_data(uuid, text) TO anon, authenticated;