-- Add INSERT policy for order_items so users can create their own order items
CREATE POLICY "Users can create their own order items"
ON order_items
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = order_items.order_id
    AND orders.user_id = auth.uid()
  )
);