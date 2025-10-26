-- Enable pgcrypto extension for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create crypt_pin function for PIN hashing
CREATE OR REPLACE FUNCTION public.crypt_pin(input_pin text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN crypt(input_pin, gen_salt('bf'));
END;
$function$;