-- Allow cashiers to insert purchases
CREATE POLICY "Cashiers can insert purchases"
ON purchases
FOR INSERT
TO public
WITH CHECK (has_role(auth.uid(), 'cashier'::app_role) AND purchased_by = auth.uid());