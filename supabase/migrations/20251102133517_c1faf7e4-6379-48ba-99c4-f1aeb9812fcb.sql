-- Create ledger accounts for existing contacts that don't have them yet
DO $$
DECLARE
  v_contact RECORD;
  v_ar_parent_id UUID;
  v_ap_parent_id UUID;
  v_customer_account_id UUID;
  v_supplier_account_id UUID;
BEGIN
  -- Get parent accounts
  SELECT id INTO v_ar_parent_id FROM accounts WHERE account_code = '1120' LIMIT 1; -- Accounts Receivable
  SELECT id INTO v_ap_parent_id FROM accounts WHERE account_code = '2110' LIMIT 1; -- Accounts Payable

  -- Loop through all contacts
  FOR v_contact IN 
    SELECT * FROM contacts 
    WHERE (is_customer = true AND customer_ledger_account_id IS NULL)
       OR (is_supplier = true AND supplier_ledger_account_id IS NULL)
  LOOP
    -- Create customer ledger account if needed
    IF v_contact.is_customer = true AND v_contact.customer_ledger_account_id IS NULL THEN
      INSERT INTO accounts (
        account_code,
        account_name,
        account_type,
        parent_account_id,
        description,
        is_active
      ) VALUES (
        '1120-' || SUBSTRING(MD5(v_contact.id::TEXT) FROM 1 FOR 6),
        v_contact.name || ' (Customer)',
        'asset',
        v_ar_parent_id,
        'Customer ledger for ' || v_contact.name,
        true
      ) RETURNING id INTO v_customer_account_id;
      
      UPDATE contacts 
      SET customer_ledger_account_id = v_customer_account_id
      WHERE id = v_contact.id;
    END IF;

    -- Create supplier ledger account if needed
    IF v_contact.is_supplier = true AND v_contact.supplier_ledger_account_id IS NULL THEN
      INSERT INTO accounts (
        account_code,
        account_name,
        account_type,
        parent_account_id,
        description,
        is_active
      ) VALUES (
        '2110-' || SUBSTRING(MD5(v_contact.id::TEXT) FROM 1 FOR 6),
        v_contact.name || ' (Supplier)',
        'liability',
        v_ap_parent_id,
        'Supplier ledger for ' || v_contact.name,
        true
      ) RETURNING id INTO v_supplier_account_id;
      
      UPDATE contacts 
      SET supplier_ledger_account_id = v_supplier_account_id
      WHERE id = v_contact.id;
    END IF;
  END LOOP;
END $$;