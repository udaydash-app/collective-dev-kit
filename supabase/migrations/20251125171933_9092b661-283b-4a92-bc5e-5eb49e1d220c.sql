-- Update the trigger function to create/update journal entries for all paid orders
CREATE OR REPLACE FUNCTION public.handle_online_order_journal_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cash_account_id UUID;
  v_mobile_money_account_id UUID;
  v_sales_account_id UUID;
  v_tax_account_id UUID;
  v_ar_account_id UUID;
  v_customer_ledger_id UUID;
  v_journal_entry_id UUID;
  v_payment_account_id UUID;
BEGIN
  -- Handle DELETE: Remove journal entry when order is deleted
  IF TG_OP = 'DELETE' THEN
    DELETE FROM journal_entries WHERE reference = OLD.order_number;
    RETURN OLD;
  END IF;

  -- Handle UPDATE: Create or update journal entry when payment_status is 'paid'
  IF TG_OP = 'UPDATE' AND NEW.payment_status = 'paid' THEN
    
    -- Delete existing journal entry if it exists (we'll recreate it with updated values)
    DELETE FROM journal_entries WHERE reference = NEW.order_number;

    -- Get account IDs
    SELECT id INTO v_cash_account_id FROM accounts WHERE account_code IN ('1010', '1110') AND is_active = true LIMIT 1;
    SELECT id INTO v_mobile_money_account_id FROM accounts WHERE account_code = '1015' LIMIT 1;
    SELECT id INTO v_sales_account_id FROM accounts WHERE account_code = '4010' LIMIT 1;
    SELECT id INTO v_tax_account_id FROM accounts WHERE account_code = '2020' LIMIT 1;
    SELECT id INTO v_ar_account_id FROM accounts WHERE account_code = '1030' LIMIT 1;

    -- Get customer ledger account if customer_id is set
    IF NEW.customer_id IS NOT NULL THEN
      SELECT customer_ledger_account_id INTO v_customer_ledger_id 
      FROM contacts 
      WHERE id = NEW.customer_id;
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
      posted_at
    ) VALUES (
      'Online Sale - ' || NEW.order_number,
      CURRENT_DATE,
      NEW.order_number,
      NEW.total,
      NEW.total,
      NEW.total,
      'posted',
      NOW()
    ) RETURNING id INTO v_journal_entry_id;

    -- Determine payment account based on payment method
    CASE NEW.payment_method
      WHEN 'cash' THEN v_payment_account_id := v_cash_account_id;
      WHEN 'mobile_money' THEN v_payment_account_id := v_mobile_money_account_id;
      WHEN 'card' THEN v_payment_account_id := v_cash_account_id;
      WHEN 'credit' THEN v_payment_account_id := COALESCE(v_customer_ledger_id, v_ar_account_id);
      ELSE v_payment_account_id := v_cash_account_id;
    END CASE;

    -- Debit: Payment account (cash/credit/mobile money received)
    IF v_payment_account_id IS NOT NULL AND NEW.total > 0 THEN
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
          WHEN NEW.payment_method = 'credit' THEN 'Sale on credit'
          ELSE 'Payment received - ' || COALESCE(NEW.payment_method, 'cash')
        END,
        NEW.total,
        0
      );
    END IF;

    -- Credit: Sales revenue
    IF NEW.subtotal > 0 THEN
      INSERT INTO journal_entry_lines (
        journal_entry_id, 
        account_id, 
        description, 
        debit_amount, 
        credit_amount
      ) VALUES (
        v_journal_entry_id,
        v_sales_account_id,
        'Sales revenue',
        0,
        NEW.subtotal
      );
    END IF;

    -- Credit: Tax (if any)
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
        'Sales tax',
        0,
        NEW.tax
      );
    END IF;

  END IF;

  RETURN NEW;
END;
$$;