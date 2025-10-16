-- Allow admins to update order items
CREATE POLICY "Admins can update order items"
ON public.order_items
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'admin'::app_role
  )
);

-- Allow admins to delete order items
CREATE POLICY "Admins can delete order items"
ON public.order_items
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'admin'::app_role
  )
);