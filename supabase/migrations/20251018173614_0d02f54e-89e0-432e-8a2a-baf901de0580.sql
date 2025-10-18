-- Create offers table
CREATE TABLE public.offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  discount_percentage INTEGER,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  link_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

-- Allow anyone to view active offers
CREATE POLICY "Anyone can view active offers"
ON public.offers
FOR SELECT
USING (is_active = true AND start_date <= now() AND end_date >= now());

-- Admins can view all offers
CREATE POLICY "Admins can view all offers"
ON public.offers
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can insert offers
CREATE POLICY "Admins can insert offers"
ON public.offers
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update offers
CREATE POLICY "Admins can update offers"
ON public.offers
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can delete offers
CREATE POLICY "Admins can delete offers"
ON public.offers
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_offers_updated_at
BEFORE UPDATE ON public.offers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();