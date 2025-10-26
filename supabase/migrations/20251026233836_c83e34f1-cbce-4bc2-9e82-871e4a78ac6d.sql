-- Drop the restrictive admin-only delete policy
DROP POLICY IF EXISTS "Admins can delete pos transactions" ON pos_transactions;

-- Allow cashiers to delete their own pos transactions
CREATE POLICY "Cashiers can delete their own pos transactions"
ON pos_transactions
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'cashier') AND cashier_id = auth.uid());

-- Allow admins to delete any pos transactions
CREATE POLICY "Admins can delete any pos transactions"
ON pos_transactions
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'));