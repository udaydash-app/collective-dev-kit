-- Create expenses table for tracking daily expenses
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id),
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  payment_method TEXT NOT NULL,
  receipt_url TEXT,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_expenses_store_date ON public.expenses(store_id, expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_created_by ON public.expenses(created_by);

-- Enable RLS
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for expenses
CREATE POLICY "Admins can view all expenses"
  ON public.expenses
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert expenses"
  ON public.expenses
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update expenses"
  ON public.expenses
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete expenses"
  ON public.expenses
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Cashiers can view expenses"
  ON public.expenses
  FOR SELECT
  USING (has_role(auth.uid(), 'cashier'::app_role));

CREATE POLICY "Cashiers can insert expenses"
  ON public.expenses
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'cashier'::app_role) AND created_by = auth.uid());

-- Add trigger for updated_at
CREATE TRIGGER update_expenses_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();