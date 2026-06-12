
CREATE TABLE IF NOT EXISTS public.cash_register_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  type text NOT NULL CHECK (type IN ('in','out')),
  amount numeric NOT NULL DEFAULT 0,
  description text,
  counterparty text,
  payment_method text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_register_entries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_register_entries TO anon;
GRANT ALL ON public.cash_register_entries TO service_role;

ALTER TABLE public.cash_register_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view cash register entries"
  ON public.cash_register_entries FOR SELECT USING (true);
CREATE POLICY "Anyone can insert cash register entries"
  ON public.cash_register_entries FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update cash register entries"
  ON public.cash_register_entries FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete cash register entries"
  ON public.cash_register_entries FOR DELETE USING (true);

CREATE OR REPLACE FUNCTION public.touch_cash_register_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_cash_register_touch ON public.cash_register_entries;
CREATE TRIGGER trg_cash_register_touch
  BEFORE UPDATE ON public.cash_register_entries
  FOR EACH ROW EXECUTE FUNCTION public.touch_cash_register_updated_at();

CREATE INDEX IF NOT EXISTS cash_register_entries_date_idx
  ON public.cash_register_entries (entry_date DESC);
