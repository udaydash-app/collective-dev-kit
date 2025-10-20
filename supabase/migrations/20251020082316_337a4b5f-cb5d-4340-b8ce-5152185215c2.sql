-- Update all existing products to be unavailable
UPDATE public.products
SET is_available = false
WHERE is_available = true;

-- Change default value for is_available to false for new products
ALTER TABLE public.products
ALTER COLUMN is_available SET DEFAULT false;