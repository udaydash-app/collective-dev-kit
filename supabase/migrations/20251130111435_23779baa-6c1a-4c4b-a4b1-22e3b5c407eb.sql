-- Allow public access to purchase orders via share token
CREATE POLICY "Anyone can view purchase orders via share token"
ON purchase_orders
FOR SELECT
TO public
USING (share_token IS NOT NULL);

-- Allow public access to purchase order items via their parent PO's share token
CREATE POLICY "Anyone can view purchase order items via share token"
ON purchase_order_items
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM purchase_orders
    WHERE purchase_orders.id = purchase_order_items.purchase_order_id
    AND purchase_orders.share_token IS NOT NULL
  )
);