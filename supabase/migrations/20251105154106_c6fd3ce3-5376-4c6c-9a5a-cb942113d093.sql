-- First, remove duplicate journal entries (keep only the first one created)
DELETE FROM journal_entries je1
WHERE je1.reference LIKE 'POS-%'
  AND EXISTS (
    SELECT 1 
    FROM journal_entries je2
    WHERE je2.reference = je1.reference
      AND je2.id < je1.id
      AND je2.description = je1.description
  );

-- Drop and recreate the trigger function with better duplicate prevention
DROP TRIGGER IF EXISTS handle_pos_journal_entry_trigger ON pos_transactions;

CREATE OR REPLACE FUNCTION public.handle_pos_journal_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cash_account_id UUID;
  v_mobile_money_account_id UUID;
  v_sales_account_id UUID;
  v_discount_account_id UUID;
  v_tax_account_id UUID;
  v_ar_account_id UUID;
  v_customer_ledger_id UUID;
  v_journal_entry_id UUID;
  v_payment_account_id UUID;
  v_existing_entry_count INTEGER;
BEGIN
  -- Handle DELETE - remove the associated journal entry
  IF TG_OP = 'DELETE' THEN
    DELETE FROM journal_entries 
    WHERE reference = OLD.transaction_number 
      AND description = 'POS Sale - ' || OLD.transaction_number;
    RETURN OLD;
  END IF;

  -- Handle UPDATE - delete old journal entry first
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM journal_entries 
    WHERE reference = OLD.transaction_number 
      AND description = 'POS Sale - ' || OLD.transaction_number;
  END IF;

  -- Check if journal entry already exists for this transaction
  SELECT COUNT(*) INTO v_existing_entry_count
  FROM journal_entries
  WHERE reference = NEW.transaction_number
    AND description = 'POS Sale - ' || NEW.transaction_number;

  -- If entry already exists, skip creating another one
  IF v_existing_entry_count > 0 THEN
    RETURN NEW;
  END IF;

  -- Get account IDs
  SELECT id INTO v_cash_account_id FROM accounts WHERE account_code = '1010' LIMIT 1;
  SELECT id INTO v_mobile_money_account_id FROM accounts WHERE account_code = '1015' LIMIT 1;
  SELECT id INTO v_sales_account_id FROM accounts WHERE account_code = '4010' LIMIT 1;
  SELECT id INTO v_discount_account_id FROM accounts WHERE account_code = '4020' LIMIT 1;
  SELECT id INTO v_tax_account_id FROM accounts WHERE account_code = '2020' LIMIT 1;
  SELECT id INTO v_ar_account_id FROM accounts WHERE account_code = '1030' LIMIT 1;

  -- Get customer ledger account if customer is linked
  IF NEW.customer_id IS NOT NULL THEN
    SELECT customer_ledger_account_id INTO v_customer_ledger_id
    FROM contacts
    WHERE id = NEW.customer_id;
  END IF;

  -- Create journal entry with correct totals for balanced entry
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
    'POS Sale - ' || NEW.transaction_number,
    CURRENT_DATE,
    NEW.transaction_number,
    CASE 
      WHEN v_customer_ledger_id IS NOT NULL AND NEW.payment_method != 'credit' 
      THEN NEW.total * 2
      ELSE NEW.total 
    END,
    CASE 
      WHEN v_customer_ledger_id IS NOT NULL AND NEW.payment_method != 'credit' 
      THEN NEW.subtotal + NEW.tax + NEW.total
      ELSE NEW.subtotal + NEW.tax 
    END,
    'posted',
    NEW.cashier_id,
    NEW.cashier_id,
    NOW()
  ) RETURNING id INTO v_journal_entry_id;

  -- Determine payment account
  IF NEW.payment_method = 'mobile_money' THEN
    v_payment_account_id := v_mobile_money_account_id;
  ELSIF NEW.payment_method = 'cash' THEN
    v_payment_account_id := v_cash_account_id;
  END IF;

  -- MAIN LOGIC: Always post sale to customer account if customer is linked
  IF v_customer_ledger_id IS NOT NULL THEN
    -- Step 1: Record the sale (Debit Customer AR)
    INSERT INTO journal_entry_lines (
      journal_entry_id,
      account_id,
      description,
      debit_amount,
      credit_amount
    ) VALUES (
      v_journal_entry_id,
      v_customer_ledger_id,
      'Sale to customer',
      NEW.total,
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
      NEW.subtotal
    );

    -- Step 2: If paid immediately, record the payment
    IF NEW.payment_method != 'credit' AND v_payment_account_id IS NOT NULL THEN
      -- Debit Cash/Mobile Money
      INSERT INTO journal_entry_lines (
        journal_entry_id,
        account_id,
        description,
        debit_amount,
        credit_amount
      ) VALUES (
        v_journal_entry_id,
        v_payment_account_id,
        'Payment received - ' || NEW.payment_method,
        NEW.total,
        0
      );

      -- Credit Customer AR (payment)
      INSERT INTO journal_entry_lines (
        journal_entry_id,
        account_id,
        description,
        debit_amount,
        credit_amount
      ) VALUES (
        v_journal_entry_id,
        v_customer_ledger_id,
        'Payment received - ' || NEW.payment_method,
        0,
        NEW.total
      );
    END IF;
  ELSE
    -- No customer linked
    IF v_payment_account_id IS NOT NULL THEN
      INSERT INTO journal_entry_lines (
        journal_entry_id,
        account_id,
        description,
        debit_amount,
        credit_amount
      ) VALUES (
        v_journal_entry_id,
        COALESCE(v_payment_account_id, v_ar_account_id),
        'POS Sale - ' || NEW.payment_method,
        NEW.total,
        0
      );
    ELSE
      INSERT INTO journal_entry_lines (
        journal_entry_id,
        account_id,
        description,
        debit_amount,
        credit_amount
      ) VALUES (
        v_journal_entry_id,
        v_ar_account_id,
        'POS Sale - credit',
        NEW.total,
        0
      );
    END IF;

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
      NEW.subtotal
    );
  END IF;

  -- Sales Tax
  IF NEW.tax > 0 THEN
    INSERT INTO journal_entry_lines (
      journal_entry_id,
      account_id,
      description,
      debit_amount,
      credit_amount
    ) VALUES (
      v_journal_entry_id,
      v_tax_account_id,
      'Sales Tax Collected',
      0,
      NEW.tax
    );
  END IF;

  -- Sales Discount
  IF NEW.discount > 0 AND v_discount_account_id IS NOT NULL THEN
    INSERT INTO journal_entry_lines (
      journal_entry_id,
      account_id,
      description,
      debit_amount,
      credit_amount
    ) VALUES (
      v_journal_entry_id,
      v_discount_account_id,
      'Sales Discount',
      NEW.discount,
      0
    );
  END IF;

  RETURN NEW;
END;
$function$;

-- Recreate the trigger
CREATE TRIGGER handle_pos_journal_entry_trigger
  AFTER INSERT OR UPDATE OR DELETE ON pos_transactions
  FOR EACH ROW
  EXECUTE FUNCTION handle_pos_journal_entry();