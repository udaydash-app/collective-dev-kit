-- Add language, region, and currency preferences to user profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS language text DEFAULT 'en',
ADD COLUMN IF NOT EXISTS region text,
ADD COLUMN IF NOT EXISTS currency text;