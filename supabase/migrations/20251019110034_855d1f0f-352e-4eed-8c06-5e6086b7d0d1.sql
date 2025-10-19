-- Add background_image_url column to announcements table
ALTER TABLE public.announcements
ADD COLUMN background_image_url TEXT;