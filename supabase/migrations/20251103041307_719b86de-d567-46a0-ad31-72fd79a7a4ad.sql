-- Create customer_product_prices table for direct customer pricing
CREATE TABLE IF NOT EXISTS public.customer_product_prices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  price numeric NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(customer_id, product_id)
);

-- Enable RLS
ALTER TABLE public.customer_product_prices ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can view all customer product prices"
  ON public.customer_product_prices
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert customer product prices"
  ON public.customer_product_prices
  FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update customer product prices"
  ON public.customer_product_prices
  FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete customer product prices"
  ON public.customer_product_prices
  FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Cashiers can view customer product prices"
  ON public.customer_product_prices
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'cashier'::app_role));

-- Create updated_at trigger
CREATE TRIGGER update_customer_product_prices_updated_at
  BEFORE UPDATE ON public.customer_product_prices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_customer_product_prices_customer_id ON public.customer_product_prices(customer_id);
CREATE INDEX idx_customer_product_prices_product_id ON public.customer_product_prices(product_id);