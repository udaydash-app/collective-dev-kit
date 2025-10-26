-- Add barcode column to products table
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS barcode TEXT;

-- Create unique index on barcode for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_barcode ON public.products(barcode) WHERE barcode IS NOT NULL;

-- Create pos_transactions table
CREATE TABLE public.pos_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_number TEXT NOT NULL UNIQUE DEFAULT 'POS-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 10)),
  store_id UUID REFERENCES public.stores(id) NOT NULL,
  cashier_id UUID NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal NUMERIC(10, 2) NOT NULL,
  tax NUMERIC(10, 2) NOT NULL DEFAULT 0,
  discount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  total NUMERIC(10, 2) NOT NULL,
  payment_method TEXT NOT NULL,
  payment_details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable RLS on pos_transactions
ALTER TABLE public.pos_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for pos_transactions
CREATE POLICY "Admins can view all pos transactions"
  ON public.pos_transactions
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Cashiers can view their own pos transactions"
  ON public.pos_transactions
  FOR SELECT
  USING (has_role(auth.uid(), 'cashier') AND cashier_id = auth.uid());

CREATE POLICY "Admins can insert pos transactions"
  ON public.pos_transactions
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Cashiers can insert pos transactions"
  ON public.pos_transactions
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'cashier') AND cashier_id = auth.uid());

CREATE POLICY "Admins can update pos transactions"
  ON public.pos_transactions
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));

-- Add trigger for updated_at
CREATE TRIGGER update_pos_transactions_updated_at
  BEFORE UPDATE ON public.pos_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Update products RLS to allow cashiers to view products
CREATE POLICY "Cashiers can view available products"
  ON public.products
  FOR SELECT
  USING (has_role(auth.uid(), 'cashier') AND is_available = true);