-- Create cash_sessions table to track daily cash management
CREATE TABLE IF NOT EXISTS public.cash_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  cashier_id uuid NOT NULL,
  opening_cash numeric NOT NULL DEFAULT 0,
  closing_cash numeric NULL,
  expected_cash numeric NULL,
  cash_difference numeric NULL,
  opened_at timestamp with time zone NOT NULL DEFAULT now(),
  closed_at timestamp with time zone NULL,
  notes text NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cash_sessions ENABLE ROW LEVEL SECURITY;

-- Admins can view all cash sessions
CREATE POLICY "Admins can view all cash sessions"
ON public.cash_sessions
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Cashiers can view their own cash sessions
CREATE POLICY "Cashiers can view own cash sessions"
ON public.cash_sessions
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'cashier'::app_role) AND cashier_id = auth.uid()
);

-- Admins can insert cash sessions
CREATE POLICY "Admins can insert cash sessions"
ON public.cash_sessions
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Cashiers can insert their own cash sessions
CREATE POLICY "Cashiers can insert own cash sessions"
ON public.cash_sessions
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'cashier'::app_role) AND cashier_id = auth.uid()
);

-- Admins can update cash sessions
CREATE POLICY "Admins can update cash sessions"
ON public.cash_sessions
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Cashiers can update their own open cash sessions
CREATE POLICY "Cashiers can update own open cash sessions"
ON public.cash_sessions
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'cashier'::app_role) AND 
  cashier_id = auth.uid() AND 
  status = 'open'
);

-- Create trigger for updated_at
CREATE TRIGGER update_cash_sessions_updated_at
  BEFORE UPDATE ON public.cash_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_cash_sessions_cashier_status ON public.cash_sessions(cashier_id, status);
CREATE INDEX idx_cash_sessions_store_status ON public.cash_sessions(store_id, status);