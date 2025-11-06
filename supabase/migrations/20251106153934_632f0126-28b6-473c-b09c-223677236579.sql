-- Add DELETE policies for supplier_payments table
CREATE POLICY "Admins can delete supplier payments"
ON public.supplier_payments
FOR DELETE
TO public
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Cashiers can delete supplier payments"
ON public.supplier_payments
FOR DELETE
TO public
USING (has_role(auth.uid(), 'cashier'::app_role));