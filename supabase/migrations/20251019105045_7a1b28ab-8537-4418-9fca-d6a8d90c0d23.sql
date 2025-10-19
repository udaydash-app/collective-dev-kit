-- Create announcements table for daily updates
CREATE TABLE public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  background_color TEXT DEFAULT '#22C55E',
  text_color TEXT DEFAULT '#FFFFFF',
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Allow anyone to view active announcements
CREATE POLICY "Anyone can view active announcements"
ON public.announcements
FOR SELECT
USING (is_active = true AND start_date <= now() AND end_date >= now());

-- Admins can view all announcements
CREATE POLICY "Admins can view all announcements"
ON public.announcements
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can insert announcements
CREATE POLICY "Admins can insert announcements"
ON public.announcements
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update announcements
CREATE POLICY "Admins can update announcements"
ON public.announcements
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can delete announcements
CREATE POLICY "Admins can delete announcements"
ON public.announcements
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_announcements_updated_at
BEFORE UPDATE ON public.announcements
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();