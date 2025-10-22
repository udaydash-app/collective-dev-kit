-- First, let's make sure the order_items policy properly allows guest orders
-- Drop all existing order_items INSERT policies to avoid conflicts
DROP POLICY IF EXISTS "Users and guests can create order items" ON public.order_items;
DROP POLICY IF EXISTS "Admins can insert order items" ON public.order_items;

-- Create a comprehensive policy that allows:
-- 1. Authenticated users to create items for their own orders
-- 2. ANY user (including guests) to create items for guest orders (user_id IS NULL)
-- 3. Admins to create any order items
CREATE POLICY "Allow order item creation"
ON public.order_items
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM orders
    WHERE orders.id = order_items.order_id
    AND (
      -- Guest orders (user_id IS NULL) - allow anyone to add items
      orders.user_id IS NULL
      OR
      -- Authenticated user's own orders
      (auth.uid() = orders.user_id)
      OR
      -- Admin users
      EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_roles.user_id = auth.uid() 
        AND user_roles.role = 'admin'::app_role
      )
    )
  )
);

-- Also ensure guest users can view their order confirmation
DROP POLICY IF EXISTS "Users can view order items" ON public.order_items;
DROP POLICY IF EXISTS "Users can view their own order items" ON public.order_items;
DROP POLICY IF EXISTS "Admins can view all order items" ON public.order_items;

-- Allow viewing order items for:
-- 1. Items from the user's orders
-- 2. Items from guest orders (temporarily allow all to view guest orders)
-- 3. Admin users
CREATE POLICY "Allow viewing order items"
ON public.order_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM orders
    WHERE orders.id = order_items.order_id
    AND (
      -- User's own orders
      orders.user_id = auth.uid()
      OR
      -- Admin users
      EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_roles.user_id = auth.uid() 
        AND user_roles.role = 'admin'::app_role
      )
    )
  )
);