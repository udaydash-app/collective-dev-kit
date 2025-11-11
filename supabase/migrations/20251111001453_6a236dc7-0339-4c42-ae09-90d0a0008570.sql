
-- Record supplier payment to INDIAN BAZAAR on 06/11/2025 via mobile money
DO $$
DECLARE
  v_journal_entry_id uuid;
BEGIN
  -- Create journal entry
  INSERT INTO journal_entries (
    entry_date,
    entry_number,
    description,
    reference,
    status,
    total_debit,
    total_credit,
    created_by
  ) VALUES (
    '2025-11-06'::date,
    'JE-' || upper(substring(md5(random()::text) from 1 for 10)),
    'Payment to supplier',
    'PYMNT-' || upper(substring(md5(random()::text) from 1 for 10)),
    'posted',
    152000,
    152000,
    (SELECT id FROM profiles WHERE role = 'admin' LIMIT 1)
  ) RETURNING id INTO v_journal_entry_id;

  -- Debit Accounts Payable (reduces liability)
  INSERT INTO journal_entry_lines (
    journal_entry_id,
    account_id,
    debit_amount,
    credit_amount,
    description
  ) VALUES (
    v_journal_entry_id,
    'ecd3d153-43ac-4e35-b3f1-2db145a1d9aa', -- INDIAN BAZAAR Supplier account
    152000,
    0,
    'Payment to supplier via mobile money'
  );

  -- Credit Mobile Money (reduces asset)
  INSERT INTO journal_entry_lines (
    journal_entry_id,
    account_id,
    debit_amount,
    credit_amount,
    description
  ) VALUES (
    v_journal_entry_id,
    'e01be02b-da4e-46e3-bbb5-b9d076b5549e', -- Mobile Money account
    0,
    152000,
    'Payment to INDIAN BAZAAR'
  );

  -- Update account balances
  UPDATE accounts SET current_balance = current_balance - 152000 
  WHERE id = 'ecd3d153-43ac-4e35-b3f1-2db145a1d9aa';
  
  UPDATE accounts SET current_balance = current_balance - 152000 
  WHERE id = 'e01be02b-da4e-46e3-bbb5-b9d076b5549e';
END $$;
