-- Fix category slug that contains forward slash which breaks URL routing
UPDATE public.categories 
SET slug = 'papad-fryums' 
WHERE slug = 'PAPAD / FRYUMS';