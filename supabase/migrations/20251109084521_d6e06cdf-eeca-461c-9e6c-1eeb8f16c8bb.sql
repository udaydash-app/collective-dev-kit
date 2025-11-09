-- Create missing journal entry for purchase PUR-5ADE3A7C3B
-- This purchase exists but its journal entry was not created by the trigger

DO $$
DECLARE
  v_journal_entry_id UUID;
BEGIN
  -- Create the journal entry
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
    'Purchase - PUR-5ADE3A7C3B',
    '2025-11-06',
    'PUR-5ADE3A7C3B',
    17499.96,
    17499.96,
    'posted',
    'b518fa67-e33e-43e5-9d25-8a3b4fbbce00',
    'b518fa67-e33e-43e5-9d25-8a3b4fbbce00',
    NOW()
  )
  RETURNING id INTO v_journal_entry_id;

  -- Debit Inventory
  INSERT INTO journal_entry_lines (
    journal_entry_id,
    account_id,
    description,
    debit_amount,
    credit_amount
  ) VALUES (
    v_journal_entry_id,
    'ab478dcf-a272-4a1d-9ab6-578913ae89c1', -- Inventory account
    'Inventory Purchase from ANNAPURNA CHETAN',
    17499.96,
    0
  );

  -- Credit Supplier Ledger (payment pending)
  INSERT INTO journal_entry_lines (
    journal_entry_id,
    account_id,
    description,
    debit_amount,
    credit_amount
  ) VALUES (
    v_journal_entry_id,
    '1738b253-4c74-472b-adaf-3d449d695964', -- ANNAPURNA CHETAN supplier ledger account
    'Accounts Payable - ANNAPURNA CHETAN',
    0,
    17499.96
  );

END $$;