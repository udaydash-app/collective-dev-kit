-- Add DELETE policies for payment_receipts table
CREATE POLICY "Admins can delete payment receipts"
ON public.payment_receipts
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Cashiers can delete payment receipts"
ON public.payment_receipts
FOR DELETE
USING (has_role(auth.uid(), 'cashier'::app_role));