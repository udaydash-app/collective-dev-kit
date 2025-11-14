-- Create historical journal entries for all cash register openings since Nov 3
DO $$
DECLARE
  v_cash_account_id UUID := '4c42e00e-f8a1-4799-9884-db4dc7f0cd74';
  v_udaybhanu_account_id UUID := 'fac23dc4-c6e6-4b75-ae5d-589a8b1c125e';
  v_session RECORD;
  v_je_id UUID;
BEGIN
  FOR v_session IN 
    SELECT id, opening_cash, opened_at, cashier_id
    FROM cash_sessions
    WHERE id IN (
      'f4c51459-981f-46f5-9741-00494397db42', '5a15857d-db91-4eb1-b90f-10badf7f6e5d',
      'c98319ac-c53b-4df0-8f8b-556351179721', '60f7d6d4-af06-4c8c-b011-384fee102956',
      '97744365-bd18-479d-a84d-35276f5ef357', '8fb9e356-3f08-44c5-b614-a58b4bf0163f',
      '3bcf1388-962f-44b6-835f-ffc8c86da561', '326f7754-95f8-4720-a68f-df797bd53b0e',
      '34d09369-ce26-45b9-96c4-c30b505dad9e', '7f164318-85bd-465b-a86b-544a81f5361b',
      '5fc4f4f8-8d22-40e4-aab2-b1773c324de6'
    )
  LOOP
    INSERT INTO journal_entries (description, entry_date, reference, total_debit, total_credit, status, created_by, posted_by, posted_at)
    VALUES (
      'Cash Register Opening - Session ' || v_session.id,
      DATE(v_session.opened_at),
      'CASHREG-' || UPPER(SUBSTRING(REPLACE(v_session.id::text, '-', '') FROM 1 FOR 10)),
      v_session.opening_cash, v_session.opening_cash, 'posted',
      v_session.cashier_id, v_session.cashier_id, v_session.opened_at
    ) RETURNING id INTO v_je_id;
    
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
    VALUES (v_je_id, v_cash_account_id, 'Cash received for register opening', v_session.opening_cash, 0);
    
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
    VALUES (v_je_id, v_udaybhanu_account_id, 'Cash withdrawn for register', 0, v_session.opening_cash);
  END LOOP;
END $$;