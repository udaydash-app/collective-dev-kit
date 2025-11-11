-- Create production table to track product conversions
CREATE TABLE IF NOT EXISTS public.productions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  production_number TEXT NOT NULL DEFAULT ('PROD-' || upper(SUBSTRING(md5(random()::text) FROM 1 FOR 8))),
  production_date DATE NOT NULL DEFAULT CURRENT_DATE,
  source_product_id UUID REFERENCES public.products(id),
  source_variant_id UUID REFERENCES public.product_variants(id),
  source_quantity NUMERIC NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'completed',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT check_source_product_or_variant CHECK (
    (source_product_id IS NOT NULL AND source_variant_id IS NULL) OR
    (source_product_id IS NULL AND source_variant_id IS NOT NULL)
  )
);

-- Create production output items table to track produced items
CREATE TABLE IF NOT EXISTS public.production_outputs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  production_id UUID NOT NULL REFERENCES public.productions(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  variant_id UUID REFERENCES public.product_variants(id),
  quantity NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT check_output_product_or_variant CHECK (
    (product_id IS NOT NULL AND variant_id IS NULL) OR
    (product_id IS NULL AND variant_id IS NOT NULL)
  )
);

-- Enable Row Level Security
ALTER TABLE public.productions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_outputs ENABLE ROW LEVEL SECURITY;

-- Create policies for productions
CREATE POLICY "Admins can view all productions"
  ON public.productions FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert productions"
  ON public.productions FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update productions"
  ON public.productions FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete productions"
  ON public.productions FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Cashiers can view productions"
  ON public.productions FOR SELECT
  USING (has_role(auth.uid(), 'cashier'::app_role));

CREATE POLICY "Cashiers can insert productions"
  ON public.productions FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'cashier'::app_role));

CREATE POLICY "Cashiers can update productions"
  ON public.productions FOR UPDATE
  USING (has_role(auth.uid(), 'cashier'::app_role));

-- Create policies for production_outputs
CREATE POLICY "Admins can view all production outputs"
  ON public.production_outputs FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert production outputs"
  ON public.production_outputs FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update production outputs"
  ON public.production_outputs FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete production outputs"
  ON public.production_outputs FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Cashiers can view production outputs"
  ON public.production_outputs FOR SELECT
  USING (has_role(auth.uid(), 'cashier'::app_role));

CREATE POLICY "Cashiers can insert production outputs"
  ON public.production_outputs FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'cashier'::app_role));

CREATE POLICY "Cashiers can update production outputs"
  ON public.production_outputs FOR UPDATE
  USING (has_role(auth.uid(), 'cashier'::app_role));

-- Create indexes for better performance
CREATE INDEX idx_productions_source_product ON public.productions(source_product_id);
CREATE INDEX idx_productions_source_variant ON public.productions(source_variant_id);
CREATE INDEX idx_productions_date ON public.productions(production_date);
CREATE INDEX idx_production_outputs_production ON public.production_outputs(production_id);
CREATE INDEX idx_production_outputs_product ON public.production_outputs(product_id);
CREATE INDEX idx_production_outputs_variant ON public.production_outputs(variant_id);