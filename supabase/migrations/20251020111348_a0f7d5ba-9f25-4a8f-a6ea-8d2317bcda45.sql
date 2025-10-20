-- Allow anonymous users to create orders (guest checkout)
-- Remove the restrictive policies and add support for guest orders

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Deny anonymous access to orders" ON public.orders;

-- Update policy to allow guest order creation (user_id can be null for guest orders)
DROP POLICY IF EXISTS "Users can create their own orders" ON public.orders;
CREATE POLICY "Users can create orders" 
ON public.orders 
FOR INSERT 
WITH CHECK (
  -- Allow if user is authenticated and owns the order
  (auth.uid() = user_id) OR 
  -- Allow if user_id is null (guest order)
  (user_id IS NULL)
);

-- Allow viewing orders - authenticated users see their own, guests cannot view
CREATE POLICY "Users can view their orders" 
ON public.orders 
FOR SELECT 
USING (
  -- Authenticated users can see their orders
  (auth.uid() = user_id) OR
  -- Admins can see all orders
  (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'::app_role
  ))
);

-- Allow anonymous users to create order items for their orders
DROP POLICY IF EXISTS "Users can create their own order items" ON public.order_items;
CREATE POLICY "Users can create order items" 
ON public.order_items 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM orders 
    WHERE orders.id = order_items.order_id 
    AND (orders.user_id = auth.uid() OR orders.user_id IS NULL)
  )
);

-- Allow viewing order items
CREATE POLICY "Users can view order items" 
ON public.order_items 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM orders 
    WHERE orders.id = order_items.order_id 
    AND (
      orders.user_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_roles.user_id = auth.uid() 
        AND user_roles.role = 'admin'::app_role
      )
    )
  )
);

-- Make user_id nullable in orders table to support guest orders
ALTER TABLE public.orders 
ALTER COLUMN user_id DROP NOT NULL;

-- Make address_id nullable since guests don't have saved addresses
ALTER TABLE public.orders 
ALTER COLUMN address_id DROP NOT NULL;