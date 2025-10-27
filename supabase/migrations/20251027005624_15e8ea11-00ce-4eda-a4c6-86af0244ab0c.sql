-- Create stock_adjustments table to track inventory adjustments
CREATE TABLE IF NOT EXISTS public.stock_adjustments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES public.product_variants(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('manual', 'sale', 'purchase', 'damage', 'return')),
  quantity_change INTEGER NOT NULL,
  reason TEXT,
  adjusted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.stock_adjustments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for stock_adjustments
CREATE POLICY "Admins can view all stock adjustments"
  ON public.stock_adjustments
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert stock adjustments"
  ON public.stock_adjustments
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Cashiers can view stock adjustments"
  ON public.stock_adjustments
  FOR SELECT
  USING (has_role(auth.uid(), 'cashier'::app_role));

CREATE POLICY "Cashiers can insert stock adjustments"
  ON public.stock_adjustments
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'cashier'::app_role) AND adjusted_by = auth.uid());

-- Create index for better performance
CREATE INDEX idx_stock_adjustments_product_id ON public.stock_adjustments(product_id);
CREATE INDEX idx_stock_adjustments_store_id ON public.stock_adjustments(store_id);
CREATE INDEX idx_stock_adjustments_created_at ON public.stock_adjustments(created_at DESC);