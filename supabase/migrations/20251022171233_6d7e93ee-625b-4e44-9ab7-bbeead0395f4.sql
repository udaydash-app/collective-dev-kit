-- Drop and recreate the guest order policies with explicit USING and WITH CHECK
DROP POLICY IF EXISTS "Guest orders allowed" ON public.orders;
DROP POLICY IF EXISTS "Guest order items allowed" ON public.order_items;

-- Create policy for guest orders with both USING and WITH CHECK
CREATE POLICY "Guest orders allowed"
ON public.orders
AS PERMISSIVE
FOR INSERT
TO anon, public
WITH CHECK (user_id IS NULL);

-- Create policy for guest order items  
CREATE POLICY "Guest order items allowed"
ON public.order_items
AS PERMISSIVE
FOR INSERT
TO anon, public
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders
    WHERE orders.id = order_items.order_id
    AND orders.user_id IS NULL
  )
);

-- Also ensure anon can select from orders (needed for the EXISTS check in order_items policy)
GRANT SELECT ON public.orders TO anon;

-- Notify PostgREST to reload schema cache (if needed)
NOTIFY pgrst, 'reload schema';