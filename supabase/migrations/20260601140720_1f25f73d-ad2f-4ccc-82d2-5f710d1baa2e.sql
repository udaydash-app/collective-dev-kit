-- Convert image_url to image_urls JSONB array for multiple images
ALTER TABLE public.trading_quote_items RENAME COLUMN image_url TO image_urls;
ALTER TABLE public.trading_quote_items ALTER COLUMN image_urls TYPE JSONB USING CASE WHEN image_urls IS NOT NULL THEN to_jsonb(ARRAY[image_urls]) ELSE '[]'::JSONB END;
ALTER TABLE public.trading_quote_items ALTER COLUMN image_urls SET DEFAULT '[]'::JSONB;