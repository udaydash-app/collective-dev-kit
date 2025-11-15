-- Fix search_path for generate_quotation_number function
DROP FUNCTION IF EXISTS generate_quotation_number();

CREATE OR REPLACE FUNCTION generate_quotation_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN 'QT-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
END;
$$;