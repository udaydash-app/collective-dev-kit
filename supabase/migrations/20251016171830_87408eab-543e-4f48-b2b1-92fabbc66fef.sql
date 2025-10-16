-- Allow admins to view all orders
CREATE POLICY "Admins can view all orders"
ON public.orders
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'admin'::app_role
  )
);

-- Allow admins to update any order
CREATE POLICY "Admins can update all orders"
ON public.orders
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'admin'::app_role
  )
);

-- Allow admins to view all order items
CREATE POLICY "Admins can view all order items"
ON public.order_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'admin'::app_role
  )
);