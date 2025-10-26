-- Allow cashiers to update their own pos transactions
CREATE POLICY "Cashiers can update their own pos transactions"
ON pos_transactions
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'cashier') AND cashier_id = auth.uid())
WITH CHECK (has_role(auth.uid(), 'cashier') AND cashier_id = auth.uid());

-- Allow admins to delete pos_transactions
CREATE POLICY "Admins can delete pos transactions"
ON pos_transactions
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'));