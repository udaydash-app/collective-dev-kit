-- Create account types enum
CREATE TYPE account_type AS ENUM (
  'asset',
  'liability',
  'equity',
  'revenue',
  'expense'
);

-- Create Chart of Accounts table
CREATE TABLE public.accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_code TEXT NOT NULL UNIQUE,
  account_name TEXT NOT NULL,
  account_type account_type NOT NULL,
  parent_account_id UUID REFERENCES public.accounts(id),
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  current_balance NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create indexes for accounts
CREATE INDEX idx_accounts_code ON public.accounts(account_code);
CREATE INDEX idx_accounts_type ON public.accounts(account_type);
CREATE INDEX idx_accounts_parent ON public.accounts(parent_account_id);

-- Create Journal Entries table
CREATE TABLE public.journal_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_number TEXT NOT NULL UNIQUE DEFAULT ('JE-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 10))),
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reference TEXT,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  total_debit NUMERIC NOT NULL DEFAULT 0,
  total_credit NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  posted_at TIMESTAMP WITH TIME ZONE,
  posted_by UUID REFERENCES auth.users(id),
  CONSTRAINT journal_entries_balanced CHECK (total_debit = total_credit OR status = 'draft')
);

-- Create indexes for journal entries
CREATE INDEX idx_journal_entries_date ON public.journal_entries(entry_date);
CREATE INDEX idx_journal_entries_status ON public.journal_entries(status);
CREATE INDEX idx_journal_entries_number ON public.journal_entries(entry_number);

-- Create Journal Entry Lines table
CREATE TABLE public.journal_entry_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  journal_entry_id UUID NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id),
  description TEXT,
  debit_amount NUMERIC NOT NULL DEFAULT 0,
  credit_amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT journal_lines_debit_or_credit CHECK (
    (debit_amount > 0 AND credit_amount = 0) OR 
    (credit_amount > 0 AND debit_amount = 0)
  )
);

-- Create indexes for journal entry lines
CREATE INDEX idx_journal_lines_entry ON public.journal_entry_lines(journal_entry_id);
CREATE INDEX idx_journal_lines_account ON public.journal_entry_lines(account_id);

-- Enable RLS
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entry_lines ENABLE ROW LEVEL SECURITY;

-- RLS Policies for accounts
CREATE POLICY "Admins can view all accounts"
  ON public.accounts FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert accounts"
  ON public.accounts FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update accounts"
  ON public.accounts FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete accounts"
  ON public.accounts FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for journal entries
CREATE POLICY "Admins can view all journal entries"
  ON public.journal_entries FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert journal entries"
  ON public.journal_entries FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update journal entries"
  ON public.journal_entries FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete journal entries"
  ON public.journal_entries FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for journal entry lines
CREATE POLICY "Admins can view all journal entry lines"
  ON public.journal_entry_lines FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert journal entry lines"
  ON public.journal_entry_lines FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update journal entry lines"
  ON public.journal_entry_lines FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete journal entry lines"
  ON public.journal_entry_lines FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Add triggers for updated_at
CREATE TRIGGER update_accounts_updated_at
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_journal_entries_updated_at
  BEFORE UPDATE ON public.journal_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to update account balances
CREATE OR REPLACE FUNCTION public.update_account_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update the account balance based on account type
  UPDATE accounts
  SET current_balance = (
    SELECT COALESCE(
      SUM(
        CASE 
          WHEN accounts.account_type IN ('asset', 'expense') THEN 
            jel.debit_amount - jel.credit_amount
          ELSE 
            jel.credit_amount - jel.debit_amount
        END
      ), 0
    )
    FROM journal_entry_lines jel
    JOIN journal_entries je ON je.id = jel.journal_entry_id
    WHERE jel.account_id = accounts.id
      AND je.status = 'posted'
  )
  WHERE id = NEW.account_id;
  
  RETURN NEW;
END;
$$;

-- Trigger to update account balances when journal entries are posted
CREATE TRIGGER update_account_balance_on_post
  AFTER INSERT OR UPDATE OR DELETE ON public.journal_entry_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.update_account_balance();

-- Insert default Chart of Accounts
INSERT INTO public.accounts (account_code, account_name, account_type, description) VALUES
-- Assets
('1000', 'Assets', 'asset', 'Main asset account'),
('1100', 'Current Assets', 'asset', 'Assets expected to be converted to cash within one year'),
('1110', 'Cash', 'asset', 'Cash on hand and in bank'),
('1120', 'Accounts Receivable', 'asset', 'Money owed by customers'),
('1130', 'Inventory', 'asset', 'Products available for sale'),
('1140', 'Prepaid Expenses', 'asset', 'Expenses paid in advance'),
('1200', 'Fixed Assets', 'asset', 'Long-term physical assets'),
('1210', 'Equipment', 'asset', 'Business equipment'),
('1220', 'Furniture & Fixtures', 'asset', 'Office furniture'),
('1230', 'Vehicles', 'asset', 'Company vehicles'),

-- Liabilities
('2000', 'Liabilities', 'liability', 'Main liability account'),
('2100', 'Current Liabilities', 'liability', 'Liabilities due within one year'),
('2110', 'Accounts Payable', 'liability', 'Money owed to suppliers'),
('2120', 'Sales Tax Payable', 'liability', 'Sales tax collected from customers'),
('2130', 'Accrued Expenses', 'liability', 'Expenses incurred but not yet paid'),
('2200', 'Long-term Liabilities', 'liability', 'Liabilities due after one year'),
('2210', 'Loans Payable', 'liability', 'Bank loans and other debts'),

-- Equity
('3000', 'Equity', 'equity', 'Owner equity'),
('3100', 'Owner Capital', 'equity', 'Initial and additional owner investments'),
('3200', 'Retained Earnings', 'equity', 'Accumulated profits'),
('3300', 'Drawings', 'equity', 'Owner withdrawals'),

-- Revenue
('4000', 'Revenue', 'revenue', 'Income from business operations'),
('4100', 'Sales Revenue', 'revenue', 'Revenue from product sales'),
('4110', 'Product Sales', 'revenue', 'Revenue from selling products'),
('4120', 'Service Revenue', 'revenue', 'Revenue from services'),
('4200', 'Other Income', 'revenue', 'Non-operating income'),

-- Expenses
('5000', 'Expenses', 'expense', 'Business expenses'),
('5100', 'Cost of Goods Sold', 'expense', 'Direct costs of products sold'),
('5200', 'Operating Expenses', 'expense', 'Regular business operating costs'),
('5210', 'Rent Expense', 'expense', 'Rent for business premises'),
('5220', 'Utilities Expense', 'expense', 'Electricity, water, internet'),
('5230', 'Salaries & Wages', 'expense', 'Employee compensation'),
('5240', 'Marketing & Advertising', 'expense', 'Promotional expenses'),
('5250', 'Office Supplies', 'expense', 'Office consumables'),
('5260', 'Insurance Expense', 'expense', 'Business insurance'),
('5270', 'Depreciation Expense', 'expense', 'Asset depreciation'),
('5280', 'Bank Charges', 'expense', 'Banking fees'),
('5290', 'Miscellaneous Expense', 'expense', 'Other operating expenses');