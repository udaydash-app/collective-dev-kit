-- Add opening_balance field to accounts table
ALTER TABLE public.accounts 
ADD COLUMN IF NOT EXISTS opening_balance NUMERIC DEFAULT 0;

COMMENT ON COLUMN public.accounts.opening_balance IS 'Starting balance for the account at the beginning of accounting period';