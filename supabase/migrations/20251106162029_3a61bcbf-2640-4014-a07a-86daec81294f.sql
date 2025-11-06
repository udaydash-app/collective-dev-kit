-- Fix opening balance logic: positive = customer receivable, negative = supplier payable
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

  -- Handle UPDATE operations for opening balance changes
  IF TG_OP = 'UPDATE' THEN
    -- Handle customer opening balance update (positive values only)
    IF NEW.is_customer = true AND NEW.customer_ledger_account_id IS NOT NULL THEN
      IF OLD.opening_balance IS DISTINCT FROM NEW.opening_balance THEN
        -- Delete old customer opening balance journal entry
        DELETE FROM journal_entries 
        WHERE reference LIKE 'OB-CUST-%'
          AND (description = 'Opening Balance - ' || OLD.name OR description = 'Opening Balance - ' || NEW.name)
          AND EXISTS (
            SELECT 1 FROM journal_entry_lines 
            WHERE journal_entry_id = journal_entries.id 
              AND account_id = NEW.customer_ledger_account_id
          );

        -- Create new journal entry only if balance is positive (customer owes us)
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
            NEW.customer_ledger_account_id,
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

    -- Handle supplier opening balance update (negative values only)
    IF NEW.is_supplier = true AND NEW.supplier_ledger_account_id IS NOT NULL THEN
      IF OLD.opening_balance IS DISTINCT FROM NEW.opening_balance THEN
        -- Delete old supplier opening balance journal entry
        DELETE FROM journal_entries 
        WHERE reference LIKE 'OB-SUPP-%'
          AND (description = 'Opening Balance - ' || OLD.name OR description = 'Opening Balance - ' || NEW.name)
          AND EXISTS (
            SELECT 1 FROM journal_entry_lines 
            WHERE journal_entry_id = journal_entries.id 
              AND account_id = NEW.supplier_ledger_account_id
          );

        -- Create new journal entry only if balance is negative (we owe supplier)
        IF NEW.opening_balance IS NOT NULL AND NEW.opening_balance < 0 THEN
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
            ABS(NEW.opening_balance),
            ABS(NEW.opening_balance),
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
            ABS(NEW.opening_balance),
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
            NEW.supplier_ledger_account_id,
            'Opening balance payable',
            0,
            ABS(NEW.opening_balance)
          );
        END IF;
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

      -- Only create customer journal entry for positive opening balance
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

  IF NEW.is_supplier = true AND NEW.supplier_ledger_account_id IS NULL THEN
    SELECT id INTO v_existing_supplier_account
    FROM accounts
    WHERE parent_account_id = v_ap_parent_id
      AND account_name = NEW.name || ' (Supplier)'
    LIMIT 1;

    IF v_existing_supplier_account IS NOT NULL THEN
      NEW.supplier_ledger_account_id = v_existing_supplier_account;
    ELSE
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

      -- Only create supplier journal entry for negative opening balance
      IF NEW.opening_balance IS NOT NULL AND NEW.opening_balance < 0 THEN
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
          ABS(NEW.opening_balance),
          ABS(NEW.opening_balance),
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
          ABS(NEW.opening_balance),
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
          ABS(NEW.opening_balance)
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;