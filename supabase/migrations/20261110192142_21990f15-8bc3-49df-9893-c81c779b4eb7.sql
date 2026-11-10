-- Evaluate role checks once per query (initPlan) instead of once per row.
DO $$
DECLARE
  r record;
  new_qual text;
  new_check text;
  stmt text;
  re_role constant text := '((public\.)?has_role\(auth\.uid\(\), ''[a-z_]+''::(public\.)?app_role\))';
  re_pos  constant text := '((public\.)?is_active_pos_accounting_user\(auth\.uid\(\)\))';
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (coalesce(qual,'') || coalesce(with_check,'')) ~ '(has_role\(auth\.uid\(\)|is_active_pos_accounting_user\(auth\.uid\(\)\))'
  LOOP
    new_qual := r.qual;
    new_check := r.with_check;
    IF new_qual IS NOT NULL THEN
      new_qual := regexp_replace(new_qual, re_role, '(SELECT \1)', 'g');
      new_qual := regexp_replace(new_qual, re_pos, '(SELECT \1)', 'g');
    END IF;
    IF new_check IS NOT NULL THEN
      new_check := regexp_replace(new_check, re_role, '(SELECT \1)', 'g');
      new_check := regexp_replace(new_check, re_pos, '(SELECT \1)', 'g');
    END IF;
    stmt := format('ALTER POLICY %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
    IF new_qual IS NOT NULL THEN
      stmt := stmt || format(' USING (%s)', new_qual);
    END IF;
    IF new_check IS NOT NULL THEN
      stmt := stmt || format(' WITH CHECK (%s)', new_check);
    END IF;
    EXECUTE stmt;
  END LOOP;
END $$;

-- Supporting indexes for the heaviest screens
CREATE INDEX IF NOT EXISTS idx_journal_entries_status_created_at ON public.journal_entries (status, created_at);
CREATE INDEX IF NOT EXISTS idx_journal_lines_account_entry ON public.journal_entry_lines (account_id, journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_pos_transactions_items_gin ON public.pos_transactions USING gin (items jsonb_path_ops);
CREATE INDEX IF NOT EXISTS idx_products_available_name ON public.products (is_available, name);