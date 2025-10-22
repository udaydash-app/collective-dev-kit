-- Grant necessary privileges to anon role for guest checkout
GRANT USAGE ON SCHEMA public TO anon;
GRANT INSERT ON public.orders TO anon;
GRANT INSERT ON public.order_items TO anon;
GRANT SELECT ON public.products TO anon;
GRANT SELECT ON public.stores TO anon;

-- Also recreate the guest policies to explicitly target anon role
DROP POLICY IF EXISTS "Guest orders allowed" ON public.orders;
CREATE POLICY "Guest orders allowed"
ON public.orders
FOR INSERT
TO anon
WITH CHECK (user_id IS NULL);

DROP POLICY IF EXISTS "Guest order items allowed" ON public.order_items;
CREATE POLICY "Guest order items allowed"  
ON public.order_items
FOR INSERT
TO anon
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders
    WHERE orders.id = order_items.order_id
    AND orders.user_id IS NULL
  )
);