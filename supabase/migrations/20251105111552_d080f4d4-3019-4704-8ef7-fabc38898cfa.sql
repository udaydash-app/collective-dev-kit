-- First, create Owner's Equity account if it doesn't exist
INSERT INTO accounts (account_code, account_name, account_type, description, is_active)
SELECT '3010', 'Owner''s Equity', 'equity', 'Owner''s capital and retained earnings', true
WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE account_code = '3010');

-- Now create opening balance journal entries with RLS bypassed
SET session_replication_role = replica;

DO $$
DECLARE
  v_contact RECORD;
  v_equity_account_id UUID;
  v_journal_entry_id UUID;
  v_entry_count INT := 0;
BEGIN
  -- Get Owner's Equity account
  SELECT id INTO v_equity_account_id FROM accounts WHERE account_code = '3010' LIMIT 1;
  
  RAISE NOTICE 'Owner Equity Account ID: %', v_equity_account_id;
  
  -- Process all contacts with opening balances
  FOR v_contact IN 
    SELECT 
      c.id,
      c.name,
      c.opening_balance,
      c.is_customer,
      c.is_supplier,
      c.customer_ledger_account_id,
      c.supplier_ledger_account_id
    FROM contacts c
    WHERE c.opening_balance > 0
      AND (c.customer_ledger_account_id IS NOT NULL OR c.supplier_ledger_account_id IS NOT NULL)
    ORDER BY c.name
  LOOP
    -- Create customer opening balance
    IF v_contact.is_customer = true AND v_contact.customer_ledger_account_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM journal_entries je
        WHERE je.reference = 'OB-CUST-' || UPPER(SUBSTRING(REPLACE(v_contact.id::text, '-', '') FROM 1 FOR 8))
      ) THEN
        INSERT INTO journal_entries (
          description,
          entry_date,
          reference,
          total_debit,
          total_credit,
          status,
          posted_at
        ) VALUES (
          'Opening Balance - ' || v_contact.name,
          '2025-11-01'::date,
          'OB-CUST-' || UPPER(SUBSTRING(REPLACE(v_contact.id::text, '-', '') FROM 1 FOR 8)),
          v_contact.opening_balance,
          v_contact.opening_balance,
          'posted',
          NOW()
        ) RETURNING id INTO v_journal_entry_id;

        INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
        VALUES (v_journal_entry_id, v_contact.customer_ledger_account_id, 'Opening balance receivable', v_contact.opening_balance, 0);

        INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
        VALUES (v_journal_entry_id, v_equity_account_id, 'Opening balance - customer receivable', 0, v_contact.opening_balance);
        
        v_entry_count := v_entry_count + 1;
        RAISE NOTICE 'Created customer OB for: % (Amount: %)', v_contact.name, v_contact.opening_balance;
      END IF;
    END IF;

    -- Create supplier opening balance
    IF v_contact.is_supplier = true AND v_contact.supplier_ledger_account_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM journal_entries je
        WHERE je.reference = 'OB-SUPP-' || UPPER(SUBSTRING(REPLACE(v_contact.id::text, '-', '') FROM 1 FOR 8))
      ) THEN
        INSERT INTO journal_entries (
          description,
          entry_date,
          reference,
          total_debit,
          total_credit,
          status,
          posted_at
        ) VALUES (
          'Opening Balance - ' || v_contact.name,
          '2025-11-01'::date,
          'OB-SUPP-' || UPPER(SUBSTRING(REPLACE(v_contact.id::text, '-', '') FROM 1 FOR 8)),
          v_contact.opening_balance,
          v_contact.opening_balance,
          'posted',
          NOW()
        ) RETURNING id INTO v_journal_entry_id;

        INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
        VALUES (v_journal_entry_id, v_equity_account_id, 'Opening balance - supplier payable', v_contact.opening_balance, 0);

        INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
        VALUES (v_journal_entry_id, v_contact.supplier_ledger_account_id, 'Opening balance payable', 0, v_contact.opening_balance);
        
        v_entry_count := v_entry_count + 1;
        RAISE NOTICE 'Created supplier OB for: % (Amount: %)', v_contact.name, v_contact.opening_balance;
      END IF;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Successfully created % opening balance journal entries', v_entry_count;
END $$;

SET session_replication_role = DEFAULT;