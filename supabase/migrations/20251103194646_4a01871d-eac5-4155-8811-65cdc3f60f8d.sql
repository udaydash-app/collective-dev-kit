-- Update trigger to use longer account codes to prevent collisions
CREATE OR REPLACE FUNCTION public.create_contact_ledger_accounts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ar_parent_id UUID;
  v_ap_parent_id UUID;
  v_equity_account_id UUID;
  v_customer_account_id UUID;
  v_supplier_account_id UUID;
  v_journal_entry_id UUID;
  v_customer_code TEXT;
  v_supplier_code TEXT;
BEGIN
  -- Get parent accounts
  SELECT id INTO v_ar_parent_id FROM accounts WHERE account_code = '1030' LIMIT 1; -- Accounts Receivable
  SELECT id INTO v_ap_parent_id FROM accounts WHERE account_code = '2010' LIMIT 1; -- Accounts Payable
  SELECT id INTO v_equity_account_id FROM accounts WHERE account_code = '3010' LIMIT 1; -- Owner's Equity

  -- Create customer ledger account if contact is a customer
  IF NEW.is_customer = true THEN
    -- Generate unique customer account code (use 10 characters from MD5 for better uniqueness)
    v_customer_code := '1030-' || UPPER(SUBSTRING(MD5(NEW.id::TEXT || '-customer') FROM 1 FOR 10));
    
    INSERT INTO accounts (
      account_code,
      account_name,
      account_type,
      parent_account_id,
      description,
      created_by
    ) VALUES (
      v_customer_code,
      NEW.name || ' (Customer)',
      'asset',
      v_ar_parent_id,
      'Customer ledger for ' || NEW.name,
      auth.uid()
    ) RETURNING id INTO v_customer_account_id;
    
    NEW.customer_ledger_account_id = v_customer_account_id;

    -- Create journal entry for customer opening balance if present
    IF NEW.opening_balance IS NOT NULL AND NEW.opening_balance > 0 THEN
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
        'Opening Balance - ' || NEW.name,
        CURRENT_DATE,
        'OB-CUST-' || UPPER(SUBSTRING(MD5(NEW.id::TEXT) FROM 1 FOR 8)),
        NEW.opening_balance,
        NEW.opening_balance,
        'posted',
        auth.uid(),
        auth.uid(),
        NOW()
      ) RETURNING id INTO v_journal_entry_id;

      -- Debit Customer Account (Asset increases - they owe us)
      INSERT INTO journal_entry_lines (
        journal_entry_id,
        account_id,
        description,
        debit_amount,
        credit_amount
      ) VALUES (
        v_journal_entry_id,
        v_customer_account_id,
        'Opening balance receivable',
        NEW.opening_balance,
        0
      );

      -- Credit Owner's Equity (shows prior period receivable)
      INSERT INTO journal_entry_lines (
        journal_entry_id,
        account_id,
        description,
        debit_amount,
        credit_amount
      ) VALUES (
        v_journal_entry_id,
        v_equity_account_id,
        'Opening balance - customer receivable',
        0,
        NEW.opening_balance
      );
    END IF;
  END IF;

  -- Create supplier ledger account if contact is a supplier
  IF NEW.is_supplier = true THEN
    -- Generate unique supplier account code (use 10 characters from MD5 for better uniqueness)
    v_supplier_code := '2010-' || UPPER(SUBSTRING(MD5(NEW.id::TEXT || '-supplier') FROM 1 FOR 10));
    
    INSERT INTO accounts (
      account_code,
      account_name,
      account_type,
      parent_account_id,
      description,
      created_by
    ) VALUES (
      v_supplier_code,
      NEW.name || ' (Supplier)',
      'liability',
      v_ap_parent_id,
      'Supplier ledger for ' || NEW.name,
      auth.uid()
    ) RETURNING id INTO v_supplier_account_id;
    
    NEW.supplier_ledger_account_id = v_supplier_account_id;

    -- Create journal entry for supplier opening balance if present
    IF NEW.opening_balance IS NOT NULL AND NEW.opening_balance > 0 THEN
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
        'Opening Balance - ' || NEW.name,
        CURRENT_DATE,
        'OB-SUPP-' || UPPER(SUBSTRING(MD5(NEW.id::TEXT) FROM 1 FOR 8)),
        NEW.opening_balance,
        NEW.opening_balance,
        'posted',
        auth.uid(),
        auth.uid(),
        NOW()
      ) RETURNING id INTO v_journal_entry_id;

      -- Debit Owner's Equity (shows prior period payable)
      INSERT INTO journal_entry_lines (
        journal_entry_id,
        account_id,
        description,
        debit_amount,
        credit_amount
      ) VALUES (
        v_journal_entry_id,
        v_equity_account_id,
        'Opening balance - supplier payable',
        NEW.opening_balance,
        0
      );

      -- Credit Supplier Account (Liability increases - we owe them)
      INSERT INTO journal_entry_lines (
        journal_entry_id,
        account_id,
        description,
        debit_amount,
        credit_amount
      ) VALUES (
        v_journal_entry_id,
        v_supplier_account_id,
        'Opening balance payable',
        0,
        NEW.opening_balance
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;