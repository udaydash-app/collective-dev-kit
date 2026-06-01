CREATE TABLE public.trading_quote_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  brand TEXT NOT NULL,
  quality TEXT,
  packaging TEXT,
  buy_price NUMERIC(14,2) DEFAULT 0,
  sell_price NUMERIC(14,2) DEFAULT 0,
  warehouse TEXT,
  payment_condition TEXT,
  bank_details TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trading_quote_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trading_quote_items TO anon;
GRANT ALL ON public.trading_quote_items TO service_role;

ALTER TABLE public.trading_quote_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view trading quote items" ON public.trading_quote_items FOR SELECT USING (true);
CREATE POLICY "Anyone can insert trading quote items" ON public.trading_quote_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update trading quote items" ON public.trading_quote_items FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete trading quote items" ON public.trading_quote_items FOR DELETE USING (true);

CREATE TRIGGER update_trading_quote_items_updated_at
BEFORE UPDATE ON public.trading_quote_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO storage.buckets (id, name, public) VALUES ('trading-quote-images', 'trading-quote-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read trading quote images" ON storage.objects FOR SELECT USING (bucket_id = 'trading-quote-images');
CREATE POLICY "Anyone upload trading quote images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'trading-quote-images');
CREATE POLICY "Anyone update trading quote images" ON storage.objects FOR UPDATE USING (bucket_id = 'trading-quote-images');
CREATE POLICY "Anyone delete trading quote images" ON storage.objects FOR DELETE USING (bucket_id = 'trading-quote-images');