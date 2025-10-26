-- Update verify_pin to use extensions schema and set search_path
DROP FUNCTION IF EXISTS public.verify_pin(text);

CREATE OR REPLACE FUNCTION public.verify_pin(input_pin text)
RETURNS TABLE(pos_user_id uuid, user_id uuid, full_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  RETURN QUERY
  SELECT pu.id as pos_user_id, pu.user_id, pu.full_name
  FROM pos_users pu
  WHERE pu.pin_hash = extensions.crypt(input_pin, pu.pin_hash)
    AND pu.is_active = true;
END;
$$;

-- Update crypt_pin to set search_path
DROP FUNCTION IF EXISTS public.crypt_pin(text);

CREATE OR REPLACE FUNCTION public.crypt_pin(input_pin text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  RETURN extensions.crypt(input_pin, extensions.gen_salt('bf'));
END;
$$;