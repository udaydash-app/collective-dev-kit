-- Update the purchase journal entry trigger function to handle updates and deletes properly
CREATE OR REPLACE FUNCTION public.create_purchase_journal_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_inventory_account_id UUID;
  v_cash_account_id UUID;
  v_mobile_money_account_id UUID;
  v_payable_account_id UUID;
  v_supplier_ledger_id UUID;
  v_journal_entry_id UUID;
  v_payment_account_id UUID;
BEGIN
  -- Handle DELETE - remove the associated journal entry
  IF TG_OP = 'DELETE' THEN
    DELETE FROM journal_entries 
    WHERE reference = OLD.purchase_number 
      AND description = 'Purchase - ' || OLD.purchase_number;
    RETURN OLD;
  END IF;

  -- Handle UPDATE - delete old journal entry first
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM journal_entries 
    WHERE reference = OLD.purchase_number 
      AND description = 'Purchase - ' || OLD.purchase_number;
  END IF;

  -- Handle INSERT and UPDATE - create new journal entry
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
$function$;