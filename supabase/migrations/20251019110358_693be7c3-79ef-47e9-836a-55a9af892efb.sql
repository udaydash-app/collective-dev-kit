-- Add font styling columns to announcements table
ALTER TABLE public.announcements
ADD COLUMN title_font_size TEXT DEFAULT 'text-xl',
ADD COLUMN title_font_weight TEXT DEFAULT 'font-bold',
ADD COLUMN message_font_size TEXT DEFAULT 'text-base',
ADD COLUMN message_font_weight TEXT DEFAULT 'font-normal';