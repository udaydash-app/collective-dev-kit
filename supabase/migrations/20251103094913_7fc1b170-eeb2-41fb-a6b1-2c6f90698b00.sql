-- Allow cashiers to update products (for stock management in POS)
CREATE POLICY "Cashiers can update products"
ON public.products
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'cashier'::app_role))
WITH CHECK (has_role(auth.uid(), 'cashier'::app_role));

-- Allow cashiers to update product variants (for stock management in POS)
CREATE POLICY "Cashiers can update product variants"
ON public.product_variants
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'cashier'::app_role))
WITH CHECK (has_role(auth.uid(), 'cashier'::app_role));