DROP POLICY IF EXISTS "Allow authenticated order creation" ON public.orders;
DROP POLICY IF EXISTS "Allow guest order creation" ON public.orders;

CREATE POLICY "Staff can create orders"
ON public.orders FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'cashier'::app_role));

CREATE POLICY "Anon guest order creation"
ON public.orders FOR INSERT TO anon
WITH CHECK (user_id IS NULL);