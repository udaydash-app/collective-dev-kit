-- Manually create journal entry for the existing POS transaction to Annapurna Chetan
DO $$
DECLARE
  v_cash_account_id UUID;
  v_sales_account_id UUID;
  v_customer_ledger_id UUID;
  v_journal_entry_id UUID;
  v_transaction RECORD;
BEGIN
  -- Get the POS transaction
  SELECT * INTO v_transaction
  FROM pos_transactions
  WHERE transaction_number = 'POS-D03A75292D'
  LIMIT 1;

  IF v_transaction.id IS NOT NULL THEN
    -- Get account IDs
    SELECT id INTO v_sales_account_id FROM accounts WHERE account_code = '4010' LIMIT 1;
    SELECT customer_ledger_account_id INTO v_customer_ledger_id
    FROM contacts
    WHERE id = v_transaction.customer_id;

    -- Create journal entry
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
      'POS Sale - ' || v_transaction.transaction_number,
      CURRENT_DATE,
      v_transaction.transaction_number,
      v_transaction.total,
      v_transaction.subtotal + v_transaction.tax,
      'posted',
      v_transaction.cashier_id,
      v_transaction.cashier_id,
      NOW()
    ) RETURNING id INTO v_journal_entry_id;

    -- Debit Customer Account (Accounts Receivable)
    INSERT INTO journal_entry_lines (
      journal_entry_id,
      account_id,
      description,
      debit_amount,
      credit_amount
    ) VALUES (
      v_journal_entry_id,
      v_customer_ledger_id,
      'POS Sale - credit',
      v_transaction.total,
      0
    );

    -- Credit Sales Revenue
    INSERT INTO journal_entry_lines (
      journal_entry_id,
      account_id,
      description,
      debit_amount,
      credit_amount
    ) VALUES (
      v_journal_entry_id,
      v_sales_account_id,
      'Sales Revenue',
      0,
      v_transaction.subtotal - v_transaction.discount
    );

    -- Record discount if any
    IF v_transaction.discount > 0 THEN
      INSERT INTO journal_entry_lines (
        journal_entry_id,
        account_id,
        description,
        debit_amount,
        credit_amount
      ) VALUES (
        v_journal_entry_id,
        v_sales_account_id,
        'Sales Discount',
        v_transaction.discount,
        0
      );
    END IF;

    RAISE NOTICE 'Journal entry created successfully for transaction %', v_transaction.transaction_number;
  END IF;
END $$;