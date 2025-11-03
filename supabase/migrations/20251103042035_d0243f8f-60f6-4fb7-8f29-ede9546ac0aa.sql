-- Add discount_percentage column to contacts table
ALTER TABLE public.contacts
ADD COLUMN IF NOT EXISTS discount_percentage numeric DEFAULT 0;

COMMENT ON COLUMN public.contacts.discount_percentage IS 'Cart-wide discount percentage for this customer';