-- Clean up duplicate journal entries for existing purchases
-- Keep only the most recent journal entry for each purchase

WITH ranked_entries AS (
  SELECT 
    id,
    reference,
    ROW_NUMBER() OVER (PARTITION BY reference ORDER BY created_at DESC) as rn
  FROM journal_entries
  WHERE reference LIKE 'PUR-%'
    AND description LIKE 'Purchase - PUR-%'
)
DELETE FROM journal_entries
WHERE id IN (
  SELECT id FROM ranked_entries WHERE rn > 1
);

-- Update existing purchase journal entries to match current purchase data
DO $$
DECLARE
  purchase_record RECORD;
  v_inventory_account_id UUID;
  v_cash_account_id UUID;
  v_mobile_money_account_id UUID;
  v_payable_account_id UUID;
  v_supplier_ledger_id UUID;
  v_journal_entry_id UUID;
  v_payment_account_id UUID;
BEGIN
  -- Get account IDs
  SELECT id INTO v_inventory_account_id FROM accounts WHERE account_code = '1020' LIMIT 1;
  SELECT id INTO v_cash_account_id FROM accounts WHERE account_code = '1010' LIMIT 1;
  SELECT id INTO v_mobile_money_account_id FROM accounts WHERE account_code = '1015' LIMIT 1;
  SELECT id INTO v_payable_account_id FROM accounts WHERE account_code = '2010' LIMIT 1;

  -- Loop through all purchases
  FOR purchase_record IN 
    SELECT * FROM purchases
  LOOP
    -- Get supplier ledger account if exists
    SELECT supplier_ledger_account_id INTO v_supplier_ledger_id
    FROM contacts
    WHERE name = purchase_record.supplier_name AND is_supplier = true
    LIMIT 1;

    -- Find existing journal entry
    SELECT id INTO v_journal_entry_id
    FROM journal_entries
    WHERE reference = purchase_record.purchase_number
      AND description = 'Purchase - ' || purchase_record.purchase_number
    LIMIT 1;

    -- If journal entry exists, update it
    IF v_journal_entry_id IS NOT NULL THEN
      -- Delete old journal entry lines
      DELETE FROM journal_entry_lines WHERE journal_entry_id = v_journal_entry_id;

      -- Update journal entry header
      UPDATE journal_entries
      SET total_debit = purchase_record.total_amount,
          total_credit = purchase_record.total_amount
      WHERE id = v_journal_entry_id;

      -- Recreate journal entry lines with current data
      -- Debit Inventory
      INSERT INTO journal_entry_lines (
        journal_entry_id,
        account_id,
        description,
        debit_amount,
        credit_amount
      ) VALUES (
        v_journal_entry_id,
        v_inventory_account_id,
        'Inventory Purchase from ' || purchase_record.supplier_name,
        purchase_record.total_amount,
        0
      );

      -- Credit appropriate account based on payment status
      IF purchase_record.payment_status = 'paid' THEN
        IF purchase_record.payment_method = 'mobile_money' THEN
          v_payment_account_id := v_mobile_money_account_id;
        ELSE
          v_payment_account_id := v_cash_account_id;
        END IF;
      ELSE
        v_payment_account_id := COALESCE(v_supplier_ledger_id, v_payable_account_id);
      END IF;

      INSERT INTO journal_entry_lines (
        journal_entry_id,
        account_id,
        description,
        debit_amount,
        credit_amount
      ) VALUES (
        v_journal_entry_id,
        v_payment_account_id,
        CASE 
          WHEN purchase_record.payment_status = 'paid' THEN 'Payment - ' || purchase_record.payment_method
          ELSE 'Accounts Payable - ' || purchase_record.supplier_name
        END,
        0,
        purchase_record.total_amount
      );
    END IF;
  END LOOP;
END $$;