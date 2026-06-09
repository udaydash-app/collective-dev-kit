
CREATE TABLE public.trade_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trade_contacts TO authenticated;
GRANT ALL ON public.trade_contacts TO service_role;
ALTER TABLE public.trade_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read trade_contacts" ON public.trade_contacts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert trade_contacts" ON public.trade_contacts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update trade_contacts" ON public.trade_contacts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete trade_contacts" ON public.trade_contacts FOR DELETE TO authenticated USING (true);

CREATE TABLE public.trade_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  record_date DATE NOT NULL,
  contact_id UUID REFERENCES public.trade_contacts(id) ON DELETE SET NULL,
  contact_name TEXT NOT NULL DEFAULT '',
  expenses NUMERIC NOT NULL DEFAULT 0,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trade_records TO authenticated;
GRANT ALL ON public.trade_records TO service_role;
ALTER TABLE public.trade_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read trade_records" ON public.trade_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert trade_records" ON public.trade_records FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update trade_records" ON public.trade_records FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete trade_records" ON public.trade_records FOR DELETE TO authenticated USING (true);

CREATE INDEX idx_trade_records_date ON public.trade_records(record_date DESC);
CREATE INDEX idx_trade_records_contact ON public.trade_records(contact_id);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_trade_contacts_updated BEFORE UPDATE ON public.trade_contacts
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_trade_records_updated BEFORE UPDATE ON public.trade_records
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
