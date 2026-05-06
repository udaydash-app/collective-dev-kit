INSERT INTO public.pos_users (full_name, pin_hash, is_active)
VALUES ('Admin', public.crypt_pin('1111'), true);