-- PIN-based authentication for POS users
CREATE TABLE IF NOT EXISTS public.pos_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  pin_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.pos_users ENABLE ROW LEVEL SECURITY;

-- Admins can manage POS users
CREATE POLICY "Admins can view all pos users"
  ON public.pos_users FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert pos users"
  ON public.pos_users FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update pos users"
  ON public.pos_users FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete pos users"
  ON public.pos_users FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Cashiers can view their own PIN user record
CREATE POLICY "Cashiers can view own pos user"
  ON public.pos_users FOR SELECT
  USING (user_id = auth.uid());

-- Function to verify PIN
CREATE OR REPLACE FUNCTION public.verify_pin(input_pin TEXT)
RETURNS TABLE(user_id UUID, full_name TEXT) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT pu.user_id, pu.full_name
  FROM pos_users pu
  WHERE pu.pin_hash = crypt(input_pin, pu.pin_hash)
    AND pu.is_active = true;
END;
$$;

-- Insert some default POS users for testing
-- PIN: 1234 for admin, 5678 for cashier
INSERT INTO pos_users (user_id, pin_hash, full_name) 
SELECT 
  u.id,
  crypt('1234', gen_salt('bf')),
  COALESCE(p.full_name, 'Admin User')
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
WHERE EXISTS (
  SELECT 1 FROM user_roles 
  WHERE user_id = u.id AND role = 'admin'
)
ON CONFLICT (user_id) DO NOTHING;