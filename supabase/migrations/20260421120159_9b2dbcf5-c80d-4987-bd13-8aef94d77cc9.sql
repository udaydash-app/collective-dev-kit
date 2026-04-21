ALTER TABLE public.expenses 
  ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_expenses_contact_id ON public.expenses(contact_id);
CREATE INDEX IF NOT EXISTS idx_expenses_account_id ON public.expenses(account_id);