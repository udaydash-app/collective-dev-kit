
-- Restore deleted journal entry for purchase PUR-45EABDE328
-- Purchase: LOCAL MARKET, 18,000 total, pending, dated 2026-02-25
-- Pattern: Debit Inventory (31), Credit LOCAL MARKET Supplier account (40119)

DO $$
DECLARE
  v_je_id UUID;
  v_inventory_account_id UUID := 'ab478dcf-a272-4a1d-9ab6-578913ae89c1'; -- Account 31 (Inventory)
  v_supplier_account_id UUID := 'd85962c5-6e00-4ddf-9a0d-1c2c61130802'; -- Account 40119 (LOCAL MARKET Supplier)
BEGIN
  -- Make sure it doesn't already exist
  IF EXISTS (SELECT 1 FROM journal_entries WHERE reference = 'PUR-45EABDE328') THEN
    RAISE NOTICE 'Journal entry for PUR-45EABDE328 already exists, skipping.';
    RETURN;
  END IF;

  -- Insert the journal entry
  INSERT INTO journal_entries (
    description,
    entry_date,
    reference,
    total_debit,
    total_credit,
    transaction_amount,
    status,
    posted_at,
    created_at,
    updated_at
  ) VALUES (
    'Achat - PUR-45EABDE328',
    '2026-02-25',
    'PUR-45EABDE328',
    18000.00,
    18000.00,
    18000.00,
    'posted',
    '2026-02-25 17:51:13+00',
    NOW(),
    NOW()
  ) RETURNING id INTO v_je_id;

  -- Debit: Inventory (31) — stock received
  INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
  VALUES (v_je_id, v_inventory_account_id, 'Achat - PUR-45EABDE328', 18000.00, 0);

  -- Credit: LOCAL MARKET Supplier ledger (40119) — amount owed to supplier
  INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
  VALUES (v_je_id, v_supplier_account_id, 'Achat - PUR-45EABDE328', 0, 18000.00);

  RAISE NOTICE 'Journal entry restored successfully with ID: %', v_je_id;
END;
$$;
