-- Create contacts table for customers and suppliers
CREATE TABLE public.contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  contact_person TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  country TEXT,
  tax_id TEXT,
  is_customer BOOLEAN NOT NULL DEFAULT false,
  is_supplier BOOLEAN NOT NULL DEFAULT false,
  credit_limit NUMERIC,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create index for faster lookups
CREATE INDEX idx_contacts_is_customer ON public.contacts(is_customer) WHERE is_customer = true;
CREATE INDEX idx_contacts_is_supplier ON public.contacts(is_supplier) WHERE is_supplier = true;
CREATE INDEX idx_contacts_name ON public.contacts(name);
CREATE INDEX idx_contacts_email ON public.contacts(email);
CREATE INDEX idx_contacts_phone ON public.contacts(phone);

-- Enable RLS
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for contacts
CREATE POLICY "Admins can view all contacts"
  ON public.contacts
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert contacts"
  ON public.contacts
  FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update contacts"
  ON public.contacts
  FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete contacts"
  ON public.contacts
  FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Cashiers can view contacts"
  ON public.contacts
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'cashier'::app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_contacts_updated_at
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add constraint to ensure contact is at least customer or supplier
ALTER TABLE public.contacts
  ADD CONSTRAINT contacts_must_be_customer_or_supplier
  CHECK (is_customer = true OR is_supplier = true);