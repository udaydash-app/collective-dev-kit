ALTER TABLE public.products ADD COLUMN IF NOT EXISTS tva_rate numeric;
COMMENT ON COLUMN public.products.tva_rate IS 'Product TVA percentage; 0 means exempt, NULL means not configured.';
CREATE OR REPLACE FUNCTION public.validate_product_tva_rate() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN IF NEW.tva_rate IS NOT NULL AND (NEW.tva_rate < 0 OR NEW.tva_rate > 100 OR NEW.tva_rate::text IN ('NaN','Infinity','-Infinity')) THEN RAISE EXCEPTION 'TVA rate must be between 0 and 100'; END IF; RETURN NEW; END; $$;
CREATE TRIGGER validate_product_tva_rate BEFORE INSERT OR UPDATE OF tva_rate ON public.products FOR EACH ROW EXECUTE FUNCTION public.validate_product_tva_rate();
CREATE OR REPLACE FUNCTION public.snapshot_pos_product_tva() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF jsonb_typeof(NEW.items) = 'array' THEN
  NEW.items := (SELECT COALESCE(jsonb_agg(CASE WHEN item ? 'tvaRate' THEN item ELSE item || jsonb_build_object('tvaRate', (SELECT p.tva_rate FROM public.products p WHERE p.id::text = COALESCE(item->>'productId',item->>'product_id',item->>'id') LIMIT 1)) END ORDER BY ord), '[]'::jsonb) FROM jsonb_array_elements(NEW.items) WITH ORDINALITY AS x(item,ord));
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER snapshot_pos_product_tva BEFORE INSERT ON public.pos_transactions FOR EACH ROW EXECUTE FUNCTION public.snapshot_pos_product_tva();