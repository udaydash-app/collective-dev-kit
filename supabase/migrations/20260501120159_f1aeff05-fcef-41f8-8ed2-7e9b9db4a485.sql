DROP POLICY IF EXISTS "Anon can view productions" ON public.productions;
DROP POLICY IF EXISTS "Anon can insert productions" ON public.productions;
DROP POLICY IF EXISTS "Anon can update productions" ON public.productions;
DROP POLICY IF EXISTS "Anon can delete productions" ON public.productions;

DROP POLICY IF EXISTS "Anon can view production outputs" ON public.production_outputs;
DROP POLICY IF EXISTS "Anon can insert production outputs" ON public.production_outputs;
DROP POLICY IF EXISTS "Anon can update production outputs" ON public.production_outputs;
DROP POLICY IF EXISTS "Anon can delete production outputs" ON public.production_outputs;