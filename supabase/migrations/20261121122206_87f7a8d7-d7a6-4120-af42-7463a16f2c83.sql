-- 1) Accounting / dashboard functions: only PIN-signed-in admin/cashier (or server) may call
CREATE OR REPLACE FUNCTION public.get_ledger_balances(account_ids uuid[])
RETURNS TABLE(account_id uuid, balance numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND NOT COALESCE(public.is_active_pos_accounting_user(auth.uid()), false) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH mov AS (
    SELECT l.account_id AS acc,
           COALESCE(SUM(l.debit_amount), 0) AS d,
           COALESCE(SUM(l.credit_amount), 0) AS c
    FROM public.journal_entry_lines l
    JOIN public.journal_entries e ON e.id = l.journal_entry_id
    WHERE e.status = 'posted'
      AND l.account_id = ANY(account_ids)
      AND COALESCE(e.description, '') NOT ILIKE '%opening balance%'
    GROUP BY l.account_id
  ),
  contact_open AS (
    SELECT c.customer_ledger_account_id AS acc, COALESCE(c.opening_balance, 0) AS opening
    FROM public.contacts c
    WHERE c.customer_ledger_account_id = ANY(account_ids)
    UNION ALL
    SELECT c.supplier_ledger_account_id AS acc, COALESCE(c.supplier_opening_balance, 0) AS opening
    FROM public.contacts c
    WHERE c.supplier_ledger_account_id = ANY(account_ids)
  )
  SELECT a.id,
         (COALESCE(co.opening, a.opening_balance, 0)
           + CASE WHEN a.account_type IN ('asset','expense')
                  THEN (COALESCE(m.d,0) - COALESCE(m.c,0))
                  ELSE (COALESCE(m.c,0) - COALESCE(m.d,0))
             END)::numeric
  FROM public.accounts a
  LEFT JOIN mov m ON m.acc = a.id
  LEFT JOIN contact_open co ON co.acc = a.id
  WHERE a.id = ANY(account_ids);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_top_credit_customers(limit_count integer DEFAULT 10)
RETURNS TABLE(id uuid, name text, phone text, email text, balance numeric, customer_balance numeric, supplier_balance numeric, customer_ledger_account_id uuid, supplier_ledger_account_id uuid, is_customer boolean, is_supplier boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND NOT COALESCE(public.is_active_pos_accounting_user(auth.uid()), false) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT c.id, c.name, c.phone, c.email,
    CASE WHEN c.supplier_ledger_account_id IS NOT NULL
         THEN COALESCE(ca.current_balance, 0) - COALESCE(sa.current_balance, 0)
         ELSE COALESCE(ca.current_balance, 0) END AS balance,
    COALESCE(ca.current_balance, 0),
    COALESCE(sa.current_balance, 0),
    c.customer_ledger_account_id, c.supplier_ledger_account_id, c.is_customer, c.is_supplier
  FROM public.contacts c
  LEFT JOIN public.accounts ca ON ca.id = c.customer_ledger_account_id
  LEFT JOIN public.accounts sa ON sa.id = c.supplier_ledger_account_id
  WHERE c.is_customer = true
    AND c.customer_ledger_account_id IS NOT NULL
    AND COALESCE(ca.current_balance, 0) > 0
  ORDER BY 5 DESC
  LIMIT limit_count;
END;
$$;

-- generate_opening_balances: fix the guard that let every signed-in/anon caller through
DO $do$
DECLARE src text;
BEGIN
  SELECT prosrc INTO src FROM pg_proc WHERE oid = 'public.generate_opening_balances(date)'::regprocedure;
  src := replace(src,
    E'AND (auth.uid() IS NULL OR NOT public.is_active_pos_accounting_user(auth.uid()))\n     AND auth.role() NOT IN (''anon'',''authenticated'') THEN',
    E'AND (auth.uid() IS NULL OR NOT public.is_active_pos_accounting_user(auth.uid())) THEN');
  IF position('NOT IN (''anon'',''authenticated'')' IN src) > 0 THEN
    RAISE EXCEPTION 'generate_opening_balances guard not patched';
  END IF;
  EXECUTE format($f$CREATE OR REPLACE FUNCTION public.generate_opening_balances(p_cutoff date)
    RETURNS TABLE(entry_id uuid, lines_created integer)
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS %L$f$, src);
END
$do$;

-- get_modern_dashboard_data: in addition to the PIN check, require a signed-in accounting user
DO $do$
DECLARE src text;
BEGIN
  SELECT prosrc INTO src FROM pg_proc WHERE oid = 'public.get_modern_dashboard_data(uuid,text)'::regprocedure;
  src := replace(src, E'BEGIN\n  SELECT pu.full_name',
    E'BEGIN\n  IF auth.role() IS DISTINCT FROM ''service_role''\n     AND NOT COALESCE(public.is_active_pos_accounting_user(auth.uid()), false) THEN\n    RAISE EXCEPTION ''Not authorized'' USING ERRCODE = ''42501'';\n  END IF;\n\n  SELECT pu.full_name');
  IF position('Not authorized' IN src) = 0 THEN
    RAISE EXCEPTION 'get_modern_dashboard_data guard not patched';
  END IF;
  EXECUTE format($f$CREATE OR REPLACE FUNCTION public.get_modern_dashboard_data(input_pos_user_id uuid, input_pin text)
    RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS %L$f$, src);
END
$do$;

REVOKE EXECUTE ON FUNCTION public.get_ledger_balances(uuid[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_top_credit_customers(integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.generate_opening_balances(date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_modern_dashboard_data(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_ledger_balances(uuid[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_top_credit_customers(integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.generate_opening_balances(date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_modern_dashboard_data(uuid, text) TO authenticated, service_role;

-- 2) deduct_stock_fifo is unused by the app; server only
REVOKE EXECUTE ON FUNCTION public.deduct_stock_fifo(uuid, uuid, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.deduct_stock_fifo(uuid, uuid, numeric) TO service_role;

-- 3) Pin search_path on journal trigger functions
ALTER FUNCTION public.create_payment_receipt_journal_entry() SET search_path = public;
ALTER FUNCTION public.create_supplier_payment_journal_entry() SET search_path = public;
ALTER FUNCTION public.create_cash_register_closing_entry() SET search_path = public;

-- 4) Settings: staff only; public pages get just name/logo/favicon
DROP POLICY IF EXISTS "Public can view basic settings" ON public.settings;
DROP POLICY IF EXISTS "Staff can view settings" ON public.settings;
CREATE POLICY "Staff can view settings" ON public.settings
  FOR SELECT TO authenticated
  USING ((SELECT public.has_role(auth.uid(), 'admin'::public.app_role))
      OR (SELECT public.has_role(auth.uid(), 'cashier'::public.app_role)));

CREATE OR REPLACE FUNCTION public.get_public_branding()
RETURNS TABLE(company_name text, logo_url text, favicon_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT s.company_name::text, s.logo_url::text, s.favicon_url::text
  FROM public.settings s
  ORDER BY s.created_at
  LIMIT 1
$$;
REVOKE EXECUTE ON FUNCTION public.get_public_branding() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_branding() TO anon, authenticated, service_role;

-- 5) Restaurant settings and multi-product BOGO: staff only (existing staff policies remain)
DROP POLICY IF EXISTS "Public can view" ON public.restaurant_settings;
DROP POLICY IF EXISTS "Allow read access to multi_product_bogo_items" ON public.multi_product_bogo_items;
DROP POLICY IF EXISTS "Allow read access to multi_product_bogo_offers" ON public.multi_product_bogo_offers;
REVOKE SELECT ON public.restaurant_settings, public.multi_product_bogo_items, public.multi_product_bogo_offers FROM anon;