-- Drop the existing policy for users creating order items
DROP POLICY IF EXISTS "Users can create order items" ON public.order_items;

-- Create a new policy that properly handles both authenticated and guest users
CREATE POLICY "Users and guests can create order items"
ON public.order_items
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM orders
    WHERE orders.id = order_items.order_id
    AND (
      -- Authenticated users creating their own order items
      (auth.uid() IS NOT NULL AND orders.user_id = auth.uid())
      OR
      -- Guest users creating order items for guest orders
      (auth.uid() IS NULL AND orders.user_id IS NULL)
    )
  )
);