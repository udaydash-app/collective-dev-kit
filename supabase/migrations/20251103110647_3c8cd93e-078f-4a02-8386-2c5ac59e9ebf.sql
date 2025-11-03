-- Allow cashiers to update their own purchases
CREATE POLICY "Cashiers can update own purchases"
ON public.purchases
FOR UPDATE
TO public
USING (has_role(auth.uid(), 'cashier'::app_role) AND purchased_by = auth.uid())
WITH CHECK (has_role(auth.uid(), 'cashier'::app_role) AND purchased_by = auth.uid());

-- Allow cashiers to delete their own purchases
CREATE POLICY "Cashiers can delete own purchases"
ON public.purchases
FOR DELETE
TO public
USING (has_role(auth.uid(), 'cashier'::app_role) AND purchased_by = auth.uid());