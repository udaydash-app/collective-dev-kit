
-- Fix order_items RLS policy for guest orders
-- The issue: order_items policy tries to check the orders table,
-- but anonymous users might not have the right permissions for that check

DROP POLICY IF EXISTS "Allow order item creation" ON public.order_items;

-- Allow order items for guest orders (where order.user_id IS NULL)
CREATE POLICY "Guest order items allowed"
ON public.order_items
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders
    WHERE orders.id = order_items.order_id
    AND orders.user_id IS NULL
  )
);

-- Allow order items for authenticated users
CREATE POLICY "Authenticated order items allowed"
ON public.order_items
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders
    WHERE orders.id = order_items.order_id
    AND orders.user_id = auth.uid()
  )
);

-- Allow admins to create any order items
CREATE POLICY "Admin order items allowed"
ON public.order_items
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'::app_role
  )
);
