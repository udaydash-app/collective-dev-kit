
-- Replace the anon-specific policy with one that applies to all roles
DROP POLICY IF EXISTS "Guest orders allowed" ON public.orders;

-- This policy will work for ANY role (including anon) when user_id is NULL
CREATE POLICY "Guest orders allowed"
ON public.orders
FOR INSERT
WITH CHECK (user_id IS NULL);

-- Make sure the same approach for order_items
DROP POLICY IF EXISTS "Guest order items allowed" ON public.order_items;

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
