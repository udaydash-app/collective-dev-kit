-- Delete the unused duplicate account for UDAYBHANU DASH
DELETE FROM accounts 
WHERE id = '4c88594a-ac54-4ef0-9b43-543b97478393'
  AND account_code = '2010-61741F8454'
  AND account_name = 'UDAYBHANU DASH (Supplier)';

-- Improve the create_contact_ledger_accounts trigger to prevent duplicate account creation
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
  v_unique_suffix TEXT;
  v_existing_customer_account UUID;
  v_existing_supplier_account UUID;
BEGIN
  -- Get parent accounts
  SELECT id INTO v_ar_parent_id FROM accounts WHERE account_code = '1030' LIMIT 1;
  SELECT id INTO v_ap_parent_id FROM accounts WHERE account_code = '2010' LIMIT 1;
  SELECT id INTO v_equity_account_id FROM accounts WHERE account_code = '3010' LIMIT 1;

  -- Create customer ledger account if contact is a customer and doesn't already have one
  IF NEW.is_customer = true AND NEW.customer_ledger_account_id IS NULL THEN
    -- Check if a customer account already exists for this contact
    SELECT id INTO v_existing_customer_account
    FROM accounts
    WHERE parent_account_id = v_ar_parent_id
      AND account_name = NEW.name || ' (Customer)'
    LIMIT 1;

    IF v_existing_customer_account IS NOT NULL THEN
      -- Use existing account
      NEW.customer_ledger_account_id = v_existing_customer_account;
    ELSE
      -- Generate unique customer account code
      v_unique_suffix := UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', '') FROM 1 FOR 10));
      v_customer_code := '1030-' || v_unique_suffix;
      
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
          'OB-CUST-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', '') FROM 1 FOR 8)),
          NEW.opening_balance,
          NEW.opening_balance,
          'posted',
          auth.uid(),
          auth.uid(),
          NOW()
        ) RETURNING id INTO v_journal_entry_id;

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
  END IF;

  -- Create supplier ledger account if contact is a supplier and doesn't already have one
  IF NEW.is_supplier = true AND NEW.supplier_ledger_account_id IS NULL THEN
    -- Check if a supplier account already exists for this contact
    SELECT id INTO v_existing_supplier_account
    FROM accounts
    WHERE parent_account_id = v_ap_parent_id
      AND account_name = NEW.name || ' (Supplier)'
    LIMIT 1;

    IF v_existing_supplier_account IS NOT NULL THEN
      -- Use existing account
      NEW.supplier_ledger_account_id = v_existing_supplier_account;
    ELSE
      -- Generate unique supplier account code
      v_unique_suffix := UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', '') FROM 1 FOR 10));
      v_supplier_code := '2010-' || v_unique_suffix;
      
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
          'OB-SUPP-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', '') FROM 1 FOR 8)),
          NEW.opening_balance,
          NEW.opening_balance,
          'posted',
          auth.uid(),
          auth.uid(),
          NOW()
        ) RETURNING id INTO v_journal_entry_id;

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
  END IF;

  RETURN NEW;
END;
$function$;