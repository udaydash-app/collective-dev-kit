-- Phase 3, 4, 5: Accounting Integration for POS, Purchases, and Contacts

-- Function to create journal entry for POS transaction
CREATE OR REPLACE FUNCTION public.create_pos_journal_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cash_account_id uuid;
  v_sales_account_id uuid;
  v_tax_account_id uuid;
  v_cogs_account_id uuid;
  v_inventory_account_id uuid;
  v_journal_entry_id uuid;
  v_total_debit numeric;
  v_total_credit numeric;
BEGIN
  -- Get account IDs
  SELECT id INTO v_cash_account_id FROM accounts WHERE account_code = '1010' LIMIT 1; -- Cash
  SELECT id INTO v_sales_account_id FROM accounts WHERE account_code = '4010' LIMIT 1; -- Sales Revenue
  SELECT id INTO v_tax_account_id FROM accounts WHERE account_code = '2020' LIMIT 1; -- Sales Tax Payable
  SELECT id INTO v_cogs_account_id FROM accounts WHERE account_code = '5010' LIMIT 1; -- COGS
  SELECT id INTO v_inventory_account_id FROM accounts WHERE account_code = '1020' LIMIT 1; -- Inventory

  -- Calculate totals
  v_total_debit := NEW.total;
  v_total_credit := NEW.subtotal + NEW.tax;

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
    v_total_debit,
    v_total_credit,
    'posted',
    NEW.cashier_id,
    NEW.cashier_id,
    NOW()
  ) RETURNING id INTO v_journal_entry_id;

  -- Debit Cash/Bank (depending on payment method)
  INSERT INTO journal_entry_lines (
    journal_entry_id,
    account_id,
    description,
    debit_amount,
    credit_amount
  ) VALUES (
    v_journal_entry_id,
    v_cash_account_id,
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

  -- Credit Sales Tax Payable (if tax > 0)
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

-- Trigger for POS transactions
DROP TRIGGER IF EXISTS pos_transaction_accounting_trigger ON pos_transactions;
CREATE TRIGGER pos_transaction_accounting_trigger
  AFTER INSERT ON pos_transactions
  FOR EACH ROW
  EXECUTE FUNCTION create_pos_journal_entry();

-- Function to create journal entry for purchases
CREATE OR REPLACE FUNCTION public.create_purchase_journal_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inventory_account_id uuid;
  v_cash_account_id uuid;
  v_payable_account_id uuid;
  v_journal_entry_id uuid;
BEGIN
  -- Get account IDs
  SELECT id INTO v_inventory_account_id FROM accounts WHERE account_code = '1020' LIMIT 1; -- Inventory
  SELECT id INTO v_cash_account_id FROM accounts WHERE account_code = '1010' LIMIT 1; -- Cash
  SELECT id INTO v_payable_account_id FROM accounts WHERE account_code = '2010' LIMIT 1; -- Accounts Payable

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
    'Purchase - ' || NEW.purchase_number || ' from ' || NEW.supplier_name,
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

  -- Credit Cash or Accounts Payable based on payment status
  IF NEW.payment_status = 'paid' THEN
    INSERT INTO journal_entry_lines (
      journal_entry_id,
      account_id,
      description,
      debit_amount,
      credit_amount
    ) VALUES (
      v_journal_entry_id,
      v_cash_account_id,
      'Cash Payment - ' || NEW.payment_method,
      0,
      NEW.total_amount
    );
  ELSE
    INSERT INTO journal_entry_lines (
      journal_entry_id,
      account_id,
      description,
      debit_amount,
      credit_amount
    ) VALUES (
      v_journal_entry_id,
      v_payable_account_id,
      'Accounts Payable - ' || NEW.supplier_name,
      0,
      NEW.total_amount
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger for purchases
DROP TRIGGER IF EXISTS purchase_accounting_trigger ON purchases;
CREATE TRIGGER purchase_accounting_trigger
  AFTER INSERT ON purchases
  FOR EACH ROW
  EXECUTE FUNCTION create_purchase_journal_entry();

-- Function to handle purchase payment updates
CREATE OR REPLACE FUNCTION public.handle_purchase_payment_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cash_account_id uuid;
  v_payable_account_id uuid;
  v_journal_entry_id uuid;
BEGIN
  -- Only process if payment status changed from pending/partial to paid
  IF OLD.payment_status != 'paid' AND NEW.payment_status = 'paid' THEN
    -- Get account IDs
    SELECT id INTO v_cash_account_id FROM accounts WHERE account_code = '1010' LIMIT 1;
    SELECT id INTO v_payable_account_id FROM accounts WHERE account_code = '2010' LIMIT 1;

    -- Create journal entry for payment
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
      'Payment for Purchase - ' || NEW.purchase_number,
      CURRENT_DATE,
      NEW.purchase_number || '-PMT',
      NEW.total_amount,
      NEW.total_amount,
      'posted',
      auth.uid(),
      auth.uid(),
      NOW()
    ) RETURNING id INTO v_journal_entry_id;

    -- Debit Accounts Payable
    INSERT INTO journal_entry_lines (
      journal_entry_id,
      account_id,
      description,
      debit_amount,
      credit_amount
    ) VALUES (
      v_journal_entry_id,
      v_payable_account_id,
      'Payment to ' || NEW.supplier_name,
      NEW.total_amount,
      0
    );

    -- Credit Cash
    INSERT INTO journal_entry_lines (
      journal_entry_id,
      account_id,
      description,
      debit_amount,
      credit_amount
    ) VALUES (
      v_journal_entry_id,
      v_cash_account_id,
      'Cash Payment - ' || NEW.payment_method,
      0,
      NEW.total_amount
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger for purchase payment updates
DROP TRIGGER IF EXISTS purchase_payment_update_trigger ON purchases;
CREATE TRIGGER purchase_payment_update_trigger
  AFTER UPDATE ON purchases
  FOR EACH ROW
  EXECUTE FUNCTION handle_purchase_payment_update();