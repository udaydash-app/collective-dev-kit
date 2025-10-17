-- Add region, language, and currency to settings table
ALTER TABLE public.settings
ADD COLUMN IF NOT EXISTS region text DEFAULT 'Côte d''Ivoire',
ADD COLUMN IF NOT EXISTS language text DEFAULT 'en',
ADD COLUMN IF NOT EXISTS currency text DEFAULT 'XOF';

-- Update existing record with defaults if exists
UPDATE public.settings
SET 
  region = COALESCE(region, 'Côte d''Ivoire'),
  language = COALESCE(language, 'en'),
  currency = COALESCE(currency, 'XOF')
WHERE region IS NULL OR language IS NULL OR currency IS NULL;