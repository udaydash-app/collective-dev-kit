-- Create supplier_payments table for recording payments to suppliers
CREATE TABLE IF NOT EXISTS supplier_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_number TEXT NOT NULL UNIQUE DEFAULT ('SPM-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 10))),
  contact_id UUID NOT NULL REFERENCES contacts(id),
  amount NUMERIC NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'mobile_money', 'bank_transfer', 'cheque')),
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reference TEXT,
  notes TEXT,
  paid_by UUID REFERENCES auth.users(id),
  store_id UUID NOT NULL REFERENCES stores(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE supplier_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can view all supplier payments"
  ON supplier_payments FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert supplier payments"
  ON supplier_payments FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update supplier payments"
  ON supplier_payments FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Cashiers can view supplier payments"
  ON supplier_payments FOR SELECT
  USING (has_role(auth.uid(), 'cashier'::app_role));

CREATE POLICY "Cashiers can insert supplier payments"
  ON supplier_payments FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'cashier'::app_role) AND paid_by = auth.uid());

-- Create trigger function for supplier payments
CREATE OR REPLACE FUNCTION create_supplier_payment_journal_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cash_account_id UUID;
  v_mobile_money_account_id UUID;
  v_bank_account_id UUID;
  v_supplier_account_id UUID;
  v_journal_entry_id UUID;
  v_payment_account_id UUID;
BEGIN
  -- Get account IDs
  SELECT id INTO v_cash_account_id FROM accounts WHERE account_code = '1010' LIMIT 1;
  SELECT id INTO v_mobile_money_account_id FROM accounts WHERE account_code = '1015' LIMIT 1;
  SELECT id INTO v_bank_account_id FROM accounts WHERE account_code = '1011' LIMIT 1;
  
  -- Get supplier ledger account
  SELECT supplier_ledger_account_id INTO v_supplier_account_id 
  FROM contacts 
  WHERE id = NEW.contact_id;

  -- If no supplier ledger account exists, use general accounts payable
  IF v_supplier_account_id IS NULL THEN
    SELECT id INTO v_supplier_account_id FROM accounts WHERE account_code = '2010' LIMIT 1;
  END IF;

  -- Determine payment account based on method
  CASE NEW.payment_method
    WHEN 'cash' THEN v_payment_account_id := v_cash_account_id;
    WHEN 'mobile_money' THEN v_payment_account_id := v_mobile_money_account_id;
    WHEN 'bank_transfer' THEN v_payment_account_id := v_bank_account_id;
    WHEN 'cheque' THEN v_payment_account_id := v_bank_account_id;
  END CASE;

  -- Create journal entry
  INSERT INTO journal_entries (
    description,
    entry_date,
    reference,
    total_debit,
    total_credit,
    status,
    created_by,
    posted_by,
    posted_at
  ) VALUES (
    'Supplier Payment - ' || NEW.payment_number,
    NEW.payment_date,
    NEW.payment_number,
    NEW.amount,
    NEW.amount,
    'posted',
    NEW.paid_by,
    NEW.paid_by,
    NOW()
  ) RETURNING id INTO v_journal_entry_id;

  -- Debit Accounts Payable / Supplier Account (reduces liability)
  INSERT INTO journal_entry_lines (
    journal_entry_id,
    account_id,
    description,
    debit_amount,
    credit_amount
  ) VALUES (
    v_journal_entry_id,
    v_supplier_account_id,
    'Payment to supplier',
    NEW.amount,
    0
  );

  -- Credit Cash/Bank/Mobile Money (reduces asset)
  INSERT INTO journal_entry_lines (
    journal_entry_id,
    account_id,
    description,
    debit_amount,
    credit_amount
  ) VALUES (
    v_journal_entry_id,
    v_payment_account_id,
    'Payment made - ' || NEW.payment_method,
    0,
    NEW.amount
  );

  RETURN NEW;
END;
$$;

-- Create trigger for supplier payments
DROP TRIGGER IF EXISTS post_supplier_payment ON supplier_payments;
CREATE TRIGGER post_supplier_payment
  AFTER INSERT ON supplier_payments
  FOR EACH ROW
  EXECUTE FUNCTION create_supplier_payment_journal_entry();