-- Enable pgcrypto extension if not exists
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Grant usage on extensions schema
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;

-- Recreate crypt_pin function
DROP FUNCTION IF EXISTS public.crypt_pin(text);

CREATE OR REPLACE FUNCTION public.crypt_pin(input_pin text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN extensions.crypt(input_pin, extensions.gen_salt('bf'));
END;
$$;