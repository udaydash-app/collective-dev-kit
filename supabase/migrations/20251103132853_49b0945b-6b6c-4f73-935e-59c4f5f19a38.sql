-- Apply opening balance journal entries for existing contacts
DO $$
DECLARE
  contact_record RECORD;
  equity_account_id uuid;
  je_id uuid;
BEGIN
  -- Get any equity account (prefer Owner's Equity or use any equity account)
  SELECT id INTO equity_account_id 
  FROM accounts 
  WHERE account_type = 'equity'
  ORDER BY CASE WHEN account_name ILIKE '%owner%equity%' THEN 0 ELSE 1 END
  LIMIT 1;

  -- If no equity account exists, create one with a unique code
  IF equity_account_id IS NULL THEN
    INSERT INTO accounts (account_code, account_name, account_type, description)
    VALUES ('3001', 'Owner''s Equity', 'equity', 'Owner''s equity account')
    RETURNING id INTO equity_account_id;
  END IF;

  -- Process existing contacts with opening balances
  FOR contact_record IN 
    SELECT id, name, opening_balance, is_customer, is_supplier, 
           customer_ledger_account_id, supplier_ledger_account_id
    FROM contacts
    WHERE opening_balance IS NOT NULL 
    AND opening_balance != 0
  LOOP
    -- Handle customer opening balance
    IF contact_record.is_customer AND contact_record.customer_ledger_account_id IS NOT NULL THEN
      -- Check if journal entry already exists
      IF NOT EXISTS (
        SELECT 1 FROM journal_entries 
        WHERE reference = 'CONTACT-OPENING-' || contact_record.id::text
        AND description LIKE '%Opening balance for customer%'
      ) THEN
        -- Create journal entry
        INSERT INTO journal_entries (
          entry_date,
          reference,
          description,
          status,
          total_debit,
          total_credit
        ) VALUES (
          CURRENT_DATE,
          'CONTACT-OPENING-' || contact_record.id::text,
          'Opening balance for customer: ' || contact_record.name,
          'posted',
          ABS(contact_record.opening_balance),
          ABS(contact_record.opening_balance)
        ) RETURNING id INTO je_id;

        -- Debit customer account (Accounts Receivable)
        INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description)
        VALUES (je_id, contact_record.customer_ledger_account_id, ABS(contact_record.opening_balance), 0, 'Customer opening balance');

        -- Credit Owner's Equity
        INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description)
        VALUES (je_id, equity_account_id, 0, ABS(contact_record.opening_balance), 'Customer opening balance');
      END IF;
    END IF;

    -- Handle supplier opening balance
    IF contact_record.is_supplier AND contact_record.supplier_ledger_account_id IS NOT NULL THEN
      -- Check if journal entry already exists
      IF NOT EXISTS (
        SELECT 1 FROM journal_entries 
        WHERE reference = 'CONTACT-OPENING-' || contact_record.id::text
        AND description LIKE '%Opening balance for supplier%'
      ) THEN
        -- Create journal entry
        INSERT INTO journal_entries (
          entry_date,
          reference,
          description,
          status,
          total_debit,
          total_credit
        ) VALUES (
          CURRENT_DATE,
          'CONTACT-OPENING-' || contact_record.id::text,
          'Opening balance for supplier: ' || contact_record.name,
          'posted',
          ABS(contact_record.opening_balance),
          ABS(contact_record.opening_balance)
        ) RETURNING id INTO je_id;

        -- Debit Owner's Equity
        INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description)
        VALUES (je_id, equity_account_id, ABS(contact_record.opening_balance), 0, 'Supplier opening balance');

        -- Credit supplier account (Accounts Payable)
        INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description)
        VALUES (je_id, contact_record.supplier_ledger_account_id, 0, ABS(contact_record.opening_balance), 'Supplier opening balance');
      END IF;
    END IF;
  END LOOP;
END $$;