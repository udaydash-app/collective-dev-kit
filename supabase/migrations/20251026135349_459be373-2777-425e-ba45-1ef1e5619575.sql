-- Create default test POS user with PIN 1234
DO $$
DECLARE
  hashed_pin TEXT;
BEGIN
  -- Hash the default PIN '1234'
  SELECT crypt('1234', gen_salt('bf')) INTO hashed_pin;
  
  -- Insert test user if it doesn't exist
  INSERT INTO public.pos_users (full_name, pin_hash, is_active)
  SELECT 'Test Cashier', hashed_pin, true
  WHERE NOT EXISTS (
    SELECT 1 FROM public.pos_users WHERE full_name = 'Test Cashier'
  );
END $$;