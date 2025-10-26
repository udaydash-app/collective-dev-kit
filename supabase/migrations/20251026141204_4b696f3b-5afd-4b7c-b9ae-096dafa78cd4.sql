-- Fix crypt_pin function with explicit type casting
DROP FUNCTION IF EXISTS public.crypt_pin(text);

CREATE OR REPLACE FUNCTION public.crypt_pin(input_pin text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN crypt(input_pin, gen_salt('bf'::text));
END;
$function$;