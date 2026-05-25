
-- 1) Lock down pos_chat_messages to staff only
DROP POLICY IF EXISTS "Anyone can read pos chat" ON public.pos_chat_messages;
DROP POLICY IF EXISTS "Anyone can send pos chat" ON public.pos_chat_messages;
DROP POLICY IF EXISTS "Anyone can delete pos chat" ON public.pos_chat_messages;

CREATE POLICY "Staff can read pos chat"
ON public.pos_chat_messages FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'cashier'::app_role)
);

CREATE POLICY "Staff can send pos chat"
ON public.pos_chat_messages FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'cashier'::app_role)
);

CREATE POLICY "Admins can delete pos chat"
ON public.pos_chat_messages FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 2) Lock down import_logs INSERT to admins only
DROP POLICY IF EXISTS "System can insert import logs" ON public.import_logs;

CREATE POLICY "Admins can insert import logs"
ON public.import_logs FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
