-- Allow any authenticated user to read accounting data (private project).
-- Writes remain restricted to admin/cashier via existing policies.

CREATE POLICY "Authenticated can view accounts"
ON public.accounts FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can view contacts"
ON public.contacts FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can view journal entries"
ON public.journal_entries FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can view journal entry lines"
ON public.journal_entry_lines FOR SELECT TO authenticated USING (true);