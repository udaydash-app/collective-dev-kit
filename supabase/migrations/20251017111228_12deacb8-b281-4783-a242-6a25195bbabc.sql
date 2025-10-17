-- Create settings table for company information
CREATE TABLE IF NOT EXISTS public.settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL DEFAULT 'Global Market',
  company_email text,
  company_phone text,
  company_address text,
  logo_url text,
  favicon_url text,
  primary_color text DEFAULT '#22C55E',
  secondary_color text DEFAULT '#1E293B',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Only admins can view settings
CREATE POLICY "Admins can view settings"
ON public.settings
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'::app_role
  )
);

-- Only admins can update settings
CREATE POLICY "Admins can update settings"
ON public.settings
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'::app_role
  )
);

-- Only admins can insert settings
CREATE POLICY "Admins can insert settings"
ON public.settings
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'::app_role
  )
);

-- Anyone can view basic settings (for public display)
CREATE POLICY "Public can view basic settings"
ON public.settings
FOR SELECT
USING (true);

-- Insert default settings
INSERT INTO public.settings (company_name, company_email, company_phone, company_address)
VALUES (
  'Global Market',
  'contact@globalmarket.com',
  '+225 07 79 78 47 83',
  'Abidjan, Côte d''Ivoire'
)
ON CONFLICT DO NOTHING;

-- Add trigger for updated_at
CREATE TRIGGER update_settings_updated_at
BEFORE UPDATE ON public.settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();