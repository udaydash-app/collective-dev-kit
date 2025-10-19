-- Add quantity column to product_variants
ALTER TABLE public.product_variants ADD COLUMN quantity NUMERIC;

-- Add label column for display purposes
ALTER TABLE public.product_variants ADD COLUMN label TEXT;