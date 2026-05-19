CREATE TABLE public.special_offers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  threshold_amount NUMERIC NOT NULL CHECK (threshold_amount > 0),
  discount_percentage NUMERIC NOT NULL CHECK (discount_percentage > 0 AND discount_percentage <= 100),
  match_mode TEXT NOT NULL DEFAULT 'equals' CHECK (match_mode IN ('equals','gte')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  store_id UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.special_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view special offers"
  ON public.special_offers FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert special offers"
  ON public.special_offers FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update special offers"
  ON public.special_offers FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete special offers"
  ON public.special_offers FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_special_offers_updated_at
  BEFORE UPDATE ON public.special_offers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_special_offers_active ON public.special_offers(is_active) WHERE is_active = true;