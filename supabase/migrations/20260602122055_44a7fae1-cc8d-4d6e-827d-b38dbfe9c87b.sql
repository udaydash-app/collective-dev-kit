
DROP POLICY IF EXISTS "Admins can view all analytics" ON public.analytics_events;
CREATE POLICY "Admins can view all analytics" ON public.analytics_events
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can view import logs" ON public.import_logs;
CREATE POLICY "Admins can view import logs" ON public.import_logs
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
