-- Ensure cashiers can view product variants
CREATE POLICY "Cashiers can view available product variants"
  ON public.product_variants
  FOR SELECT
  USING (has_role(auth.uid(), 'cashier') AND is_available = true);