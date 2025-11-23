-- Enable realtime for orders table
ALTER TABLE orders REPLICA IDENTITY FULL;

-- Drop existing publication if exists and recreate
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE orders;
  END IF;
END $$;

-- Add orders table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE orders;

-- Check and update RLS policies for orders table
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own orders" ON orders;
DROP POLICY IF EXISTS "Admins can view all orders" ON orders;
DROP POLICY IF EXISTS "Allow guest order creation" ON orders;
DROP POLICY IF EXISTS "Allow authenticated order creation" ON orders;

-- Enable RLS on orders
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can view all orders
CREATE POLICY "Admins can view all orders" ON orders
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'cashier')
  )
);

-- Policy: Users can view their own orders
CREATE POLICY "Users can view their own orders" ON orders
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Policy: Allow guest order creation (for website checkout)
CREATE POLICY "Allow guest order creation" ON orders
FOR INSERT
TO anon
WITH CHECK (true);

-- Policy: Allow authenticated order creation
CREATE POLICY "Allow authenticated order creation" ON orders
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Policy: Admins can update orders
CREATE POLICY "Admins can update orders" ON orders
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'cashier')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'cashier')
  )
);

-- Also ensure order_items has proper policies
DROP POLICY IF EXISTS "Admins can view all order items" ON order_items;
DROP POLICY IF EXISTS "Users can view their order items" ON order_items;
DROP POLICY IF EXISTS "Allow order items insertion" ON order_items;

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Admins can view all order items
CREATE POLICY "Admins can view all order items" ON order_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'cashier')
  )
);

-- Users can view their own order items
CREATE POLICY "Users can view their order items" ON order_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = order_items.order_id
    AND orders.user_id = auth.uid()
  )
);

-- Allow order items insertion (for both guest and authenticated)
CREATE POLICY "Allow order items insertion" ON order_items
FOR INSERT
WITH CHECK (true);