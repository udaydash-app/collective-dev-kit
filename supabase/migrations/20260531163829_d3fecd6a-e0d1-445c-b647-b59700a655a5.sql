
ALTER TABLE public.restaurant_orders ADD COLUMN IF NOT EXISTS guest_count integer NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS public.restaurant_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL DEFAULT 'Restaurant',
  logo_url text,
  address text,
  phone text,
  email text,
  website text,
  tax_number text,
  receipt_footer text DEFAULT 'Thank you for dining with us!',
  currency_symbol text NOT NULL DEFAULT 'FCFA',
  paper_width_mm integer NOT NULL DEFAULT 80,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_settings TO authenticated;
GRANT ALL ON public.restaurant_settings TO service_role;

ALTER TABLE public.restaurant_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon full access restaurant_settings" ON public.restaurant_settings FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "authenticated full access restaurant_settings" ON public.restaurant_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.restaurant_settings (company_name) 
SELECT 'Global Market Restaurant' WHERE NOT EXISTS (SELECT 1 FROM public.restaurant_settings);
