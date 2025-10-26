-- Drop and recreate verify_pin with new return type
DROP FUNCTION IF EXISTS public.verify_pin(text);

CREATE FUNCTION public.verify_pin(input_pin text)
RETURNS TABLE(pos_user_id uuid, user_id uuid, full_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT pu.id as pos_user_id, pu.user_id, pu.full_name
  FROM pos_users pu
  WHERE pu.pin_hash = crypt(input_pin, pu.pin_hash)
    AND pu.is_active = true;
END;
$function$;