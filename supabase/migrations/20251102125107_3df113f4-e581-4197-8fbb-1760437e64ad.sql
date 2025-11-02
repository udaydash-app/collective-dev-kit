-- Create payment_receipts table for recording customer payments
CREATE TABLE IF NOT EXISTS payment_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number TEXT NOT NULL UNIQUE DEFAULT ('PMT-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 10))),
  contact_id UUID NOT NULL REFERENCES contacts(id),
  amount NUMERIC NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'mobile_money', 'bank_transfer', 'cheque')),
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reference TEXT,
  notes TEXT,
  received_by UUID REFERENCES auth.users(id),
  store_id UUID NOT NULL REFERENCES stores(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE payment_receipts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can view all payment receipts"
  ON payment_receipts FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert payment receipts"
  ON payment_receipts FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update payment receipts"
  ON payment_receipts FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Cashiers can view payment receipts"
  ON payment_receipts FOR SELECT
  USING (has_role(auth.uid(), 'cashier'::app_role));

CREATE POLICY "Cashiers can insert payment receipts"
  ON payment_receipts FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'cashier'::app_role) AND received_by = auth.uid());

-- Add customer_ledger_account_id and supplier_ledger_account_id to contacts
ALTER TABLE contacts 
ADD COLUMN IF NOT EXISTS customer_ledger_account_id UUID REFERENCES accounts(id),
ADD COLUMN IF NOT EXISTS supplier_ledger_account_id UUID REFERENCES accounts(id);

-- Create trigger function to automatically create ledger accounts for contacts
CREATE OR REPLACE FUNCTION create_contact_ledger_accounts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ar_parent_id UUID;
  v_ap_parent_id UUID;
  v_customer_account_id UUID;
  v_supplier_account_id UUID;
BEGIN
  -- Get parent accounts
  SELECT id INTO v_ar_parent_id FROM accounts WHERE account_code = '1030' LIMIT 1; -- Accounts Receivable
  SELECT id INTO v_ap_parent_id FROM accounts WHERE account_code = '2010' LIMIT 1; -- Accounts Payable

  -- Create customer ledger account if contact is a customer
  IF NEW.is_customer = true THEN
    INSERT INTO accounts (
      account_code,
      account_name,
      account_type,
      parent_account_id,
      description,
      created_by
    ) VALUES (
      '1030-' || SUBSTRING(MD5(NEW.id::TEXT) FROM 1 FOR 6),
      NEW.name || ' (Customer)',
      'asset',
      v_ar_parent_id,
      'Customer ledger for ' || NEW.name,
      auth.uid()
    ) RETURNING id INTO v_customer_account_id;
    
    NEW.customer_ledger_account_id = v_customer_account_id;
  END IF;

  -- Create supplier ledger account if contact is a supplier
  IF NEW.is_supplier = true THEN
    INSERT INTO accounts (
      account_code,
      account_name,
      account_type,
      parent_account_id,
      description,
      created_by
    ) VALUES (
      '2010-' || SUBSTRING(MD5(NEW.id::TEXT) FROM 1 FOR 6),
      NEW.name || ' (Supplier)',
      'liability',
      v_ap_parent_id,
      'Supplier ledger for ' || NEW.name,
      auth.uid()
    ) RETURNING id INTO v_supplier_account_id;
    
    NEW.supplier_ledger_account_id = v_supplier_account_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for new contacts
DROP TRIGGER IF EXISTS create_contact_ledgers ON contacts;
CREATE TRIGGER create_contact_ledgers
  BEFORE INSERT ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION create_contact_ledger_accounts();

-- Create trigger function for payment receipts
CREATE OR REPLACE FUNCTION create_payment_receipt_journal_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cash_account_id UUID;
  v_mobile_money_account_id UUID;
  v_bank_account_id UUID;
  v_customer_account_id UUID;
  v_journal_entry_id UUID;
  v_payment_account_id UUID;
BEGIN
  -- Get account IDs
  SELECT id INTO v_cash_account_id FROM accounts WHERE account_code = '1010' LIMIT 1;
  SELECT id INTO v_mobile_money_account_id FROM accounts WHERE account_code = '1015' LIMIT 1;
  SELECT id INTO v_bank_account_id FROM accounts WHERE account_code = '1011' LIMIT 1;
  
  -- Get customer ledger account
  SELECT customer_ledger_account_id INTO v_customer_account_id 
  FROM contacts 
  WHERE id = NEW.contact_id;

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
    'Payment Receipt - ' || NEW.receipt_number,
    NEW.payment_date,
    NEW.receipt_number,
    NEW.amount,
    NEW.amount,
    'posted',
    NEW.received_by,
    NEW.received_by,
    NOW()
  ) RETURNING id INTO v_journal_entry_id;

  -- Debit Cash/Bank/Mobile Money
  INSERT INTO journal_entry_lines (
    journal_entry_id,
    account_id,
    description,
    debit_amount,
    credit_amount
  ) VALUES (
    v_journal_entry_id,
    v_payment_account_id,
    'Payment received - ' || NEW.payment_method,
    NEW.amount,
    0
  );

  -- Credit Customer Account (Accounts Receivable)
  INSERT INTO journal_entry_lines (
    journal_entry_id,
    account_id,
    description,
    debit_amount,
    credit_amount
  ) VALUES (
    v_journal_entry_id,
    v_customer_account_id,
    'Payment from customer',
    0,
    NEW.amount
  );

  RETURN NEW;
END;
$$;

-- Create trigger for payment receipts
DROP TRIGGER IF EXISTS post_payment_receipt ON payment_receipts;
CREATE TRIGGER post_payment_receipt
  AFTER INSERT ON payment_receipts
  FOR EACH ROW
  EXECUTE FUNCTION create_payment_receipt_journal_entry();

-- Update POS journal entry function to use customer ledger accounts
CREATE OR REPLACE FUNCTION create_pos_journal_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cash_account_id UUID;
  v_mobile_money_account_id UUID;
  v_sales_account_id UUID;
  v_tax_account_id UUID;
  v_ar_account_id UUID;
  v_customer_ledger_id UUID;
  v_journal_entry_id UUID;
  v_payment_account_id UUID;
BEGIN
  -- Get account IDs
  SELECT id INTO v_cash_account_id FROM accounts WHERE account_code = '1010' LIMIT 1;
  SELECT id INTO v_mobile_money_account_id FROM accounts WHERE account_code = '1015' LIMIT 1;
  SELECT id INTO v_sales_account_id FROM accounts WHERE account_code = '4010' LIMIT 1;
  SELECT id INTO v_tax_account_id FROM accounts WHERE account_code = '2020' LIMIT 1;
  SELECT id INTO v_ar_account_id FROM accounts WHERE account_code = '1030' LIMIT 1;

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
    'POS Sale - ' || NEW.transaction_number,
    CURRENT_DATE,
    NEW.transaction_number,
    NEW.total,
    NEW.subtotal + NEW.tax,
    'posted',
    NEW.cashier_id,
    NEW.cashier_id,
    NOW()
  ) RETURNING id INTO v_journal_entry_id;

  -- Debit appropriate account based on payment method
  IF NEW.payment_method = 'credit' THEN
    -- For credit sales, check if there's a customer with ledger account
    IF NEW.notes IS NOT NULL AND NEW.notes LIKE '%customer:%' THEN
      SELECT customer_ledger_account_id INTO v_customer_ledger_id
      FROM contacts
      WHERE id::TEXT = SUBSTRING(NEW.notes FROM 'customer:([0-9a-f-]+)');
      
      v_payment_account_id := COALESCE(v_customer_ledger_id, v_ar_account_id);
    ELSE
      v_payment_account_id := v_ar_account_id;
    END IF;
  ELSIF NEW.payment_method = 'mobile_money' THEN
    v_payment_account_id := v_mobile_money_account_id;
  ELSE
    v_payment_account_id := v_cash_account_id;
  END IF;

  -- Debit Cash/AR/Mobile Money
  INSERT INTO journal_entry_lines (
    journal_entry_id,
    account_id,
    description,
    debit_amount,
    credit_amount
  ) VALUES (
    v_journal_entry_id,
    v_payment_account_id,
    'POS Sale - ' || NEW.payment_method,
    NEW.total,
    0
  );

  -- Credit Sales Revenue
  INSERT INTO journal_entry_lines (
    journal_entry_id,
    account_id,
    description,
    debit_amount,
    credit_amount
  ) VALUES (
    v_journal_entry_id,
    v_sales_account_id,
    'Sales Revenue',
    0,
    NEW.subtotal - NEW.discount
  );

  -- Credit Sales Tax if applicable
  IF NEW.tax > 0 THEN
    INSERT INTO journal_entry_lines (
      journal_entry_id,
      account_id,
      description,
      debit_amount,
      credit_amount
    ) VALUES (
      v_journal_entry_id,
      v_tax_account_id,
      'Sales Tax Collected',
      0,
      NEW.tax
    );
  END IF;

  -- Record discount if any
  IF NEW.discount > 0 THEN
    INSERT INTO journal_entry_lines (
      journal_entry_id,
      account_id,
      description,
      debit_amount,
      credit_amount
    ) VALUES (
      v_journal_entry_id,
      v_sales_account_id,
      'Sales Discount',
      NEW.discount,
      0
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Update purchase journal entry to use supplier ledger accounts  
CREATE OR REPLACE FUNCTION create_purchase_journal_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_inventory_account_id UUID;
  v_cash_account_id UUID;
  v_mobile_money_account_id UUID;
  v_payable_account_id UUID;
  v_supplier_ledger_id UUID;
  v_journal_entry_id UUID;
  v_payment_account_id UUID;
BEGIN
  -- Get account IDs
  SELECT id INTO v_inventory_account_id FROM accounts WHERE account_code = '1020' LIMIT 1;
  SELECT id INTO v_cash_account_id FROM accounts WHERE account_code = '1010' LIMIT 1;
  SELECT id INTO v_mobile_money_account_id FROM accounts WHERE account_code = '1015' LIMIT 1;
  SELECT id INTO v_payable_account_id FROM accounts WHERE account_code = '2010' LIMIT 1;

  -- Get supplier ledger account if exists
  SELECT supplier_ledger_account_id INTO v_supplier_ledger_id
  FROM contacts
  WHERE name = NEW.supplier_name AND is_supplier = true
  LIMIT 1;

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
    'Purchase - ' || NEW.purchase_number,
    CURRENT_DATE,
    NEW.purchase_number,
    NEW.total_amount,
    NEW.total_amount,
    'posted',
    NEW.purchased_by,
    NEW.purchased_by,
    NOW()
  ) RETURNING id INTO v_journal_entry_id;

  -- Debit Inventory
  INSERT INTO journal_entry_lines (
    journal_entry_id,
    account_id,
    description,
    debit_amount,
    credit_amount
  ) VALUES (
    v_journal_entry_id,
    v_inventory_account_id,
    'Inventory Purchase from ' || NEW.supplier_name,
    NEW.total_amount,
    0
  );

  -- Credit appropriate account based on payment status
  IF NEW.payment_status = 'paid' THEN
    IF NEW.payment_method = 'mobile_money' THEN
      v_payment_account_id := v_mobile_money_account_id;
    ELSE
      v_payment_account_id := v_cash_account_id;
    END IF;
  ELSE
    v_payment_account_id := COALESCE(v_supplier_ledger_id, v_payable_account_id);
  END IF;

  INSERT INTO journal_entry_lines (
    journal_entry_id,
    account_id,
    description,
    debit_amount,
    credit_amount
  ) VALUES (
    v_journal_entry_id,
    v_payment_account_id,
    CASE 
      WHEN NEW.payment_status = 'paid' THEN 'Payment - ' || NEW.payment_method
      ELSE 'Accounts Payable - ' || NEW.supplier_name
    END,
    0,
    NEW.total_amount
  );

  RETURN NEW;
END;
$$;