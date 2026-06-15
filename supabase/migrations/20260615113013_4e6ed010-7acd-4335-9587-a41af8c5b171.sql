CREATE OR REPLACE FUNCTION public.is_active_pos_accounting_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.pos_users pu
    WHERE pu.user_id = _user_id
      AND pu.is_active = true
  )
  AND (
    public.has_role(_user_id, 'admin'::public.app_role)
    OR public.has_role(_user_id, 'cashier'::public.app_role)
  )
$$;

GRANT EXECUTE ON FUNCTION public.is_active_pos_accounting_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts TO authenticated;
GRANT ALL ON public.accounts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contacts TO authenticated;
GRANT ALL ON public.contacts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.journal_entries TO authenticated;
GRANT ALL ON public.journal_entries TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.journal_entry_lines TO authenticated;
GRANT ALL ON public.journal_entry_lines TO service_role;

DROP POLICY IF EXISTS "Admins can view all accounts" ON public.accounts;
DROP POLICY IF EXISTS "Cashiers can view accounts" ON public.accounts;
DROP POLICY IF EXISTS "Admins can insert accounts" ON public.accounts;
DROP POLICY IF EXISTS "Cashiers can insert accounts" ON public.accounts;
DROP POLICY IF EXISTS "Admins can update accounts" ON public.accounts;
DROP POLICY IF EXISTS "Cashiers can update accounts" ON public.accounts;
DROP POLICY IF EXISTS "Admins can delete accounts" ON public.accounts;
DROP POLICY IF EXISTS "Cashiers can delete accounts" ON public.accounts;

CREATE POLICY "Active POS admin or cashier can view accounts"
ON public.accounts
FOR SELECT
TO authenticated
USING (public.is_active_pos_accounting_user(auth.uid()));

CREATE POLICY "Active POS admin or cashier can insert accounts"
ON public.accounts
FOR INSERT
TO authenticated
WITH CHECK (public.is_active_pos_accounting_user(auth.uid()));

CREATE POLICY "Active POS admin or cashier can update accounts"
ON public.accounts
FOR UPDATE
TO authenticated
USING (public.is_active_pos_accounting_user(auth.uid()))
WITH CHECK (public.is_active_pos_accounting_user(auth.uid()));

CREATE POLICY "Active POS admin or cashier can delete accounts"
ON public.accounts
FOR DELETE
TO authenticated
USING (public.is_active_pos_accounting_user(auth.uid()));

DROP POLICY IF EXISTS "Admins can view all contacts" ON public.contacts;
DROP POLICY IF EXISTS "Cashiers can view contacts" ON public.contacts;
DROP POLICY IF EXISTS "Admins can insert contacts" ON public.contacts;
DROP POLICY IF EXISTS "Cashiers can insert contacts" ON public.contacts;
DROP POLICY IF EXISTS "Admins can update contacts" ON public.contacts;
DROP POLICY IF EXISTS "Cashiers can update contacts" ON public.contacts;
DROP POLICY IF EXISTS "Admins can delete contacts" ON public.contacts;
DROP POLICY IF EXISTS "Cashiers can delete contacts" ON public.contacts;

CREATE POLICY "Active POS admin or cashier can view contacts"
ON public.contacts
FOR SELECT
TO authenticated
USING (public.is_active_pos_accounting_user(auth.uid()));

CREATE POLICY "Active POS admin or cashier can insert contacts"
ON public.contacts
FOR INSERT
TO authenticated
WITH CHECK (public.is_active_pos_accounting_user(auth.uid()));

CREATE POLICY "Active POS admin or cashier can update contacts"
ON public.contacts
FOR UPDATE
TO authenticated
USING (public.is_active_pos_accounting_user(auth.uid()))
WITH CHECK (public.is_active_pos_accounting_user(auth.uid()));

CREATE POLICY "Active POS admin or cashier can delete contacts"
ON public.contacts
FOR DELETE
TO authenticated
USING (public.is_active_pos_accounting_user(auth.uid()));

DROP POLICY IF EXISTS "Admins can view all journal entries" ON public.journal_entries;
DROP POLICY IF EXISTS "Cashiers can view journal entries" ON public.journal_entries;
DROP POLICY IF EXISTS "Admins can insert journal entries" ON public.journal_entries;
DROP POLICY IF EXISTS "Cashiers can insert journal entries" ON public.journal_entries;
DROP POLICY IF EXISTS "Admins can update journal entries" ON public.journal_entries;
DROP POLICY IF EXISTS "Cashiers can update journal entries" ON public.journal_entries;
DROP POLICY IF EXISTS "Admins can delete journal entries" ON public.journal_entries;
DROP POLICY IF EXISTS "Cashiers can delete journal entries" ON public.journal_entries;

CREATE POLICY "Active POS admin or cashier can view journal entries"
ON public.journal_entries
FOR SELECT
TO authenticated
USING (public.is_active_pos_accounting_user(auth.uid()));

CREATE POLICY "Active POS admin or cashier can insert journal entries"
ON public.journal_entries
FOR INSERT
TO authenticated
WITH CHECK (public.is_active_pos_accounting_user(auth.uid()));

CREATE POLICY "Active POS admin or cashier can update journal entries"
ON public.journal_entries
FOR UPDATE
TO authenticated
USING (public.is_active_pos_accounting_user(auth.uid()))
WITH CHECK (public.is_active_pos_accounting_user(auth.uid()));

CREATE POLICY "Active POS admin or cashier can delete journal entries"
ON public.journal_entries
FOR DELETE
TO authenticated
USING (public.is_active_pos_accounting_user(auth.uid()));

DROP POLICY IF EXISTS "Admins can view all journal entry lines" ON public.journal_entry_lines;
DROP POLICY IF EXISTS "Cashiers can view journal entry lines" ON public.journal_entry_lines;
DROP POLICY IF EXISTS "Admins can insert journal entry lines" ON public.journal_entry_lines;
DROP POLICY IF EXISTS "Cashiers can insert journal entry lines" ON public.journal_entry_lines;
DROP POLICY IF EXISTS "Admins can update journal entry lines" ON public.journal_entry_lines;
DROP POLICY IF EXISTS "Cashiers can update journal entry lines" ON public.journal_entry_lines;
DROP POLICY IF EXISTS "Admins can delete journal entry lines" ON public.journal_entry_lines;
DROP POLICY IF EXISTS "Cashiers can delete journal entry lines" ON public.journal_entry_lines;

CREATE POLICY "Active POS admin or cashier can view journal entry lines"
ON public.journal_entry_lines
FOR SELECT
TO authenticated
USING (public.is_active_pos_accounting_user(auth.uid()));

CREATE POLICY "Active POS admin or cashier can insert journal entry lines"
ON public.journal_entry_lines
FOR INSERT
TO authenticated
WITH CHECK (public.is_active_pos_accounting_user(auth.uid()));

CREATE POLICY "Active POS admin or cashier can update journal entry lines"
ON public.journal_entry_lines
FOR UPDATE
TO authenticated
USING (public.is_active_pos_accounting_user(auth.uid()))
WITH CHECK (public.is_active_pos_accounting_user(auth.uid()));

CREATE POLICY "Active POS admin or cashier can delete journal entry lines"
ON public.journal_entry_lines
FOR DELETE
TO authenticated
USING (public.is_active_pos_accounting_user(auth.uid()));