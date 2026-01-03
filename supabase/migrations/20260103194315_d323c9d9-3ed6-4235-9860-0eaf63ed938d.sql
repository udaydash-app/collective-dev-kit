-- Create journal entries for all existing expenses that don't have one yet
DO $$
DECLARE
  exp RECORD;
  v_journal_entry_id UUID;
  v_expense_account_id UUID;
  v_payment_account_id UUID;
  v_cash_account_id UUID;
  v_mobile_money_account_id UUID;
BEGIN
  -- Get payment account IDs
  SELECT id INTO v_cash_account_id FROM accounts WHERE account_code = '571' AND is_active = true LIMIT 1;
  SELECT id INTO v_mobile_money_account_id FROM accounts WHERE account_code = '521' AND is_active = true LIMIT 1;
  
  -- Get default expense account
  SELECT id INTO v_expense_account_id FROM accounts 
  WHERE account_type = 'expense' AND is_active = true 
  ORDER BY account_code LIMIT 1;

  -- Loop through all expenses without journal entries
  FOR exp IN 
    SELECT e.* FROM expenses e
    LEFT JOIN journal_entries je ON je.reference = 'EXP-' || e.id::text
    WHERE je.id IS NULL
  LOOP
    -- Determine payment account based on payment method
    IF exp.payment_method = 'mobile_money' THEN
      v_payment_account_id := v_mobile_money_account_id;
    ELSIF exp.payment_method = 'card' THEN
      v_payment_account_id := v_mobile_money_account_id;
    ELSE
      v_payment_account_id := v_cash_account_id;
    END IF;

    -- Create journal entry
    INSERT INTO journal_entries (
      description,
      entry_date,
      reference,
      total_debit,
      total_credit,
      transaction_amount,
      status,
      created_by,
      posted_by,
      posted_at
    ) VALUES (
      'Dépense - ' || exp.category || ': ' || exp.description,
      exp.expense_date::date,
      'EXP-' || exp.id::text,
      exp.amount,
      exp.amount,
      exp.amount,
      'posted',
      exp.created_by,
      exp.created_by,
      NOW()
    ) RETURNING id INTO v_journal_entry_id;

    -- Debit: Expense account
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
    VALUES (v_journal_entry_id, v_expense_account_id, exp.category || ' - ' || exp.description, exp.amount, 0);

    -- Credit: Payment account
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
    VALUES (v_journal_entry_id, v_payment_account_id, 
      CASE exp.payment_method 
        WHEN 'cash' THEN 'Paiement espèces'
        WHEN 'mobile_money' THEN 'Paiement Mobile Money'
        WHEN 'card' THEN 'Paiement carte'
        ELSE 'Paiement - ' || exp.payment_method
      END, 
      0, exp.amount);
      
    RAISE NOTICE 'Created journal entry for expense: % - %', exp.id, exp.description;
  END LOOP;
END $$;