-- Function to hash PIN for POS users
CREATE OR REPLACE FUNCTION public.crypt_pin(input_pin TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN crypt(input_pin, gen_salt('bf'));
END;
$$;