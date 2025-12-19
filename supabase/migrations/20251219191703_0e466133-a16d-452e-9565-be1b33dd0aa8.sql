
-- Fix: Create customer ledger accounts for existing contacts that are customers but missing customer_ledger_account_id
-- This uses SYSCOHADA code 411X for customer accounts

DO $$
DECLARE
  v_contact RECORD;
  v_customer_account_id UUID;
  v_next_code TEXT;
  v_ar_parent_id UUID;
BEGIN
  -- Get parent account for customers (411)
  SELECT id INTO v_ar_parent_id FROM accounts WHERE account_code = '411' LIMIT 1;
  
  -- Process each contact that is a customer but has no customer_ledger_account_id
  FOR v_contact IN 
    SELECT c.id, c.name
    FROM contacts c
    WHERE c.is_customer = true 
      AND c.customer_ledger_account_id IS NULL
  LOOP
    -- Get next customer account code using the get_next_customer_account_code function
    SELECT get_next_customer_account_code() INTO v_next_code;
    
    -- Create the customer ledger account
    INSERT INTO accounts (
      account_code, 
      account_name, 
      account_type, 
      parent_account_id,
      description, 
      is_active
    ) VALUES (
      v_next_code, 
      v_contact.name || ' (Customer)', 
      'asset', 
      v_ar_parent_id,
      'Customer ledger for ' || v_contact.name, 
      true
    ) RETURNING id INTO v_customer_account_id;
    
    -- Update the contact with the new customer ledger account
    UPDATE contacts 
    SET customer_ledger_account_id = v_customer_account_id
    WHERE id = v_contact.id;
    
    RAISE NOTICE 'Created customer account % for %', v_next_code, v_contact.name;
  END LOOP;
END $$;

-- Update the create_contact_ledger_accounts trigger to also handle is_customer/is_supplier flag changes on UPDATE
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
  v_existing_customer_account UUID;
  v_existing_supplier_account UUID;
BEGIN
  -- Get parent accounts using SYSCOHADA codes
  SELECT id INTO v_ar_parent_id FROM accounts WHERE account_code = '411' LIMIT 1;
  SELECT id INTO v_ap_parent_id FROM accounts WHERE account_code = '401' LIMIT 1;
  SELECT id INTO v_equity_account_id FROM accounts WHERE account_code = '101' LIMIT 1;

  -- Handle UPDATE operations
  IF TG_OP = 'UPDATE' THEN
    -- Check if is_customer flag changed from false to true (or if customer_ledger_account_id is still null)
    IF NEW.is_customer = true AND NEW.customer_ledger_account_id IS NULL THEN
      -- Check if account already exists
      SELECT id INTO v_existing_customer_account
      FROM accounts
      WHERE parent_account_id = v_ar_parent_id
        AND account_name = NEW.name || ' (Customer)'
      LIMIT 1;

      IF v_existing_customer_account IS NOT NULL THEN
        NEW.customer_ledger_account_id = v_existing_customer_account;
      ELSE
        -- Get next customer account code using SYSCOHADA 411X format
        SELECT get_next_customer_account_code() INTO v_customer_code;
        
        INSERT INTO accounts (
          account_code, account_name, account_type, parent_account_id,
          description, is_active
        ) VALUES (
          v_customer_code, NEW.name || ' (Customer)', 'asset', v_ar_parent_id,
          'Customer ledger for ' || NEW.name, true
        ) RETURNING id INTO v_customer_account_id;
        
        NEW.customer_ledger_account_id = v_customer_account_id;
      END IF;
    END IF;

    -- Check if is_supplier flag changed from false to true (or if supplier_ledger_account_id is still null)
    IF NEW.is_supplier = true AND NEW.supplier_ledger_account_id IS NULL THEN
      -- Check if account already exists
      SELECT id INTO v_existing_supplier_account
      FROM accounts
      WHERE parent_account_id = v_ap_parent_id
        AND account_name = NEW.name || ' (Supplier)'
      LIMIT 1;

      IF v_existing_supplier_account IS NOT NULL THEN
        NEW.supplier_ledger_account_id = v_existing_supplier_account;
      ELSE
        -- Get next supplier account code using SYSCOHADA 401X format
        SELECT get_next_supplier_account_code() INTO v_supplier_code;
        
        INSERT INTO accounts (
          account_code, account_name, account_type, parent_account_id,
          description, is_active
        ) VALUES (
          v_supplier_code, NEW.name || ' (Supplier)', 'liability', v_ap_parent_id,
          'Supplier ledger for ' || NEW.name, true
        ) RETURNING id INTO v_supplier_account_id;
        
        NEW.supplier_ledger_account_id = v_supplier_account_id;
      END IF;
    END IF;

    -- Handle opening balance changes (existing logic)
    IF OLD.opening_balance IS DISTINCT FROM NEW.opening_balance THEN
      IF NEW.opening_balance IS NOT NULL AND NEW.opening_balance > 0 THEN
        -- Delete old opening balance entries
        DELETE FROM journal_entries 
        WHERE (reference LIKE 'OB-CUST-%' OR reference LIKE 'OB-SUPP-%')
          AND (description = 'Opening Balance - ' || OLD.name OR description = 'Opening Balance - ' || NEW.name)
          AND EXISTS (
            SELECT 1 FROM journal_entry_lines 
            WHERE journal_entry_id = journal_entries.id 
              AND (account_id = NEW.customer_ledger_account_id OR account_id = NEW.supplier_ledger_account_id)
          );

        -- Create customer receivable entry only
        IF NEW.is_customer = true AND NEW.customer_ledger_account_id IS NOT NULL THEN
          INSERT INTO journal_entries (
            description, entry_date, reference, total_debit, total_credit,
            status, created_by, posted_by, posted_at
          ) VALUES (
            'Opening Balance - ' || NEW.name, CURRENT_DATE,
            'OB-CUST-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', '') FROM 1 FOR 8)),
            NEW.opening_balance, NEW.opening_balance,
            'posted', auth.uid(), auth.uid(), NOW()
          ) RETURNING id INTO v_journal_entry_id;

          INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
          VALUES (v_journal_entry_id, NEW.customer_ledger_account_id, 'Opening balance receivable', NEW.opening_balance, 0);

          INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
          VALUES (v_journal_entry_id, v_equity_account_id, 'Opening balance - customer receivable', 0, NEW.opening_balance);
        END IF;

      ELSIF NEW.opening_balance IS NOT NULL AND NEW.opening_balance < 0 THEN
        -- Delete old opening balance entries
        DELETE FROM journal_entries 
        WHERE (reference LIKE 'OB-CUST-%' OR reference LIKE 'OB-SUPP-%')
          AND (description = 'Opening Balance - ' || OLD.name OR description = 'Opening Balance - ' || NEW.name)
          AND EXISTS (
            SELECT 1 FROM journal_entry_lines 
            WHERE journal_entry_id = journal_entries.id 
              AND (account_id = NEW.customer_ledger_account_id OR account_id = NEW.supplier_ledger_account_id)
          );

        -- Create supplier payable entry only
        IF NEW.is_supplier = true AND NEW.supplier_ledger_account_id IS NOT NULL THEN
          INSERT INTO journal_entries (
            description, entry_date, reference, total_debit, total_credit,
            status, created_by, posted_by, posted_at
          ) VALUES (
            'Opening Balance - ' || NEW.name, CURRENT_DATE,
            'OB-SUPP-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', '') FROM 1 FOR 8)),
            ABS(NEW.opening_balance), ABS(NEW.opening_balance),
            'posted', auth.uid(), auth.uid(), NOW()
          ) RETURNING id INTO v_journal_entry_id;

          INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
          VALUES (v_journal_entry_id, v_equity_account_id, 'Opening balance - supplier payable', ABS(NEW.opening_balance), 0);

          INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
          VALUES (v_journal_entry_id, NEW.supplier_ledger_account_id, 'Opening balance payable', 0, ABS(NEW.opening_balance));
        END IF;

      ELSE
        -- Zero or null opening balance: delete all opening balance entries
        DELETE FROM journal_entries 
        WHERE (reference LIKE 'OB-CUST-%' OR reference LIKE 'OB-SUPP-%')
          AND (description = 'Opening Balance - ' || OLD.name OR description = 'Opening Balance - ' || NEW.name)
          AND EXISTS (
            SELECT 1 FROM journal_entry_lines 
            WHERE journal_entry_id = journal_entries.id 
              AND (account_id = NEW.customer_ledger_account_id OR account_id = NEW.supplier_ledger_account_id)
          );
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  -- Handle INSERT operations
  IF NEW.is_customer = true AND NEW.customer_ledger_account_id IS NULL THEN
    SELECT id INTO v_existing_customer_account
    FROM accounts
    WHERE parent_account_id = v_ar_parent_id
      AND account_name = NEW.name || ' (Customer)'
    LIMIT 1;

    IF v_existing_customer_account IS NOT NULL THEN
      NEW.customer_ledger_account_id = v_existing_customer_account;
    ELSE
      SELECT get_next_customer_account_code() INTO v_customer_code;
      
      INSERT INTO accounts (
        account_code, account_name, account_type, parent_account_id,
        description, is_active
      ) VALUES (
        v_customer_code, NEW.name || ' (Customer)', 'asset', v_ar_parent_id,
        'Customer ledger for ' || NEW.name, true
      ) RETURNING id INTO v_customer_account_id;
      
      NEW.customer_ledger_account_id = v_customer_account_id;

      IF NEW.opening_balance IS NOT NULL AND NEW.opening_balance > 0 THEN
        INSERT INTO journal_entries (
          description, entry_date, reference, total_debit, total_credit,
          status, created_by, posted_by, posted_at
        ) VALUES (
          'Opening Balance - ' || NEW.name, CURRENT_DATE,
          'OB-CUST-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', '') FROM 1 FOR 8)),
          NEW.opening_balance, NEW.opening_balance,
          'posted', auth.uid(), auth.uid(), NOW()
        ) RETURNING id INTO v_journal_entry_id;

        INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
        VALUES (v_journal_entry_id, v_customer_account_id, 'Opening balance receivable', NEW.opening_balance, 0);

        INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
        VALUES (v_journal_entry_id, v_equity_account_id, 'Opening balance - customer receivable', 0, NEW.opening_balance);
      END IF;
    END IF;
  END IF;

  IF NEW.is_supplier = true AND NEW.supplier_ledger_account_id IS NULL THEN
    SELECT id INTO v_existing_supplier_account
    FROM accounts
    WHERE parent_account_id = v_ap_parent_id
      AND account_name = NEW.name || ' (Supplier)'
    LIMIT 1;

    IF v_existing_supplier_account IS NOT NULL THEN
      NEW.supplier_ledger_account_id = v_existing_supplier_account;
    ELSE
      SELECT get_next_supplier_account_code() INTO v_supplier_code;
      
      INSERT INTO accounts (
        account_code, account_name, account_type, parent_account_id,
        description, is_active
      ) VALUES (
        v_supplier_code, NEW.name || ' (Supplier)', 'liability', v_ap_parent_id,
        'Supplier ledger for ' || NEW.name, true
      ) RETURNING id INTO v_supplier_account_id;
      
      NEW.supplier_ledger_account_id = v_supplier_account_id;

      IF NEW.opening_balance IS NOT NULL AND NEW.opening_balance < 0 THEN
        INSERT INTO journal_entries (
          description, entry_date, reference, total_debit, total_credit,
          status, created_by, posted_by, posted_at
        ) VALUES (
          'Opening Balance - ' || NEW.name, CURRENT_DATE,
          'OB-SUPP-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', '') FROM 1 FOR 8)),
          ABS(NEW.opening_balance), ABS(NEW.opening_balance),
          'posted', auth.uid(), auth.uid(), NOW()
        ) RETURNING id INTO v_journal_entry_id;

        INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
        VALUES (v_journal_entry_id, v_equity_account_id, 'Opening balance - supplier payable', ABS(NEW.opening_balance), 0);

        INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
        VALUES (v_journal_entry_id, v_supplier_account_id, 'Opening balance payable', 0, ABS(NEW.opening_balance));
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
