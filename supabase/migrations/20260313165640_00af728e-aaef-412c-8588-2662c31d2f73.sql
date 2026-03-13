-- Allow anon role (used by offline/POS sessions) to access productions and production_outputs
CREATE POLICY "Anon can view productions" ON public.productions FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert productions" ON public.productions FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update productions" ON public.productions FOR UPDATE TO anon USING (true);
CREATE POLICY "Anon can delete productions" ON public.productions FOR DELETE TO anon USING (true);
CREATE POLICY "Anon can view production outputs" ON public.production_outputs FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert production outputs" ON public.production_outputs FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update production outputs" ON public.production_outputs FOR UPDATE TO anon USING (true);
CREATE POLICY "Anon can delete production outputs" ON public.production_outputs FOR DELETE TO anon USING (true);