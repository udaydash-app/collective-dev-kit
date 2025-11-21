-- Update all journal entry functions to use 1110 instead of 1010 (or handle both)

-- 1. Update POS journal entry function
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
  v_cogs_account_id UUID;
  v_inventory_account_id UUID;
  v_customer_ledger_id UUID;
  v_journal_entry_id UUID;
  v_payment_account_id UUID;
  v_existing_entry_count INTEGER;
  v_total_cogs NUMERIC := 0;
  v_item JSONB;
  v_cogs_result RECORD;
  v_is_refund BOOLEAN := FALSE;
  v_abs_total NUMERIC;
  v_abs_subtotal NUMERIC;
  v_abs_discount NUMERIC;
  v_abs_tax NUMERIC;
  v_total_debit NUMERIC;
  v_total_credit NUMERIC;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM journal_entries WHERE reference = OLD.transaction_number;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    DELETE FROM journal_entries WHERE reference = OLD.transaction_number;
  END IF;

  v_is_refund := (NEW.metadata IS NOT NULL AND (NEW.metadata->>'is_refund')::boolean = true) OR NEW.total < 0;
  v_abs_total := ABS(NEW.total);
  v_abs_subtotal := ABS(NEW.subtotal);
  v_abs_discount := ABS(NEW.discount);
  v_abs_tax := ABS(NEW.tax);

  SELECT COUNT(*) INTO v_existing_entry_count FROM journal_entries WHERE reference = NEW.transaction_number;
  IF v_existing_entry_count > 0 THEN RETURN NEW; END IF;

  -- Get account IDs - handle merged cash accounts (1010/1110)
  SELECT id INTO v_cash_account_id FROM accounts WHERE account_code IN ('1010', '1110') AND is_active = true LIMIT 1;
  SELECT id INTO v_mobile_money_account_id FROM accounts WHERE account_code = '1015' LIMIT 1;
  SELECT id INTO v_sales_account_id FROM accounts WHERE account_code = '4010' LIMIT 1;
  SELECT id INTO v_discount_account_id FROM accounts WHERE account_code = '4020' LIMIT 1;
  SELECT id INTO v_tax_account_id FROM accounts WHERE account_code = '2020' LIMIT 1;
  SELECT id INTO v_ar_account_id FROM accounts WHERE account_code = '1030' LIMIT 1;
  SELECT id INTO v_cogs_account_id FROM accounts WHERE account_code = '5010' LIMIT 1;
  SELECT id INTO v_inventory_account_id FROM accounts WHERE account_code = '1020' LIMIT 1;

  IF NEW.customer_id IS NOT NULL THEN
    SELECT customer_ledger_account_id INTO v_customer_ledger_id FROM contacts WHERE id = NEW.customer_id;
  END IF;

  IF NOT v_is_refund THEN
    IF NEW.metadata IS NOT NULL AND NEW.metadata ? 'total_cogs' THEN
      v_total_cogs := (NEW.metadata->>'total_cogs')::NUMERIC;
    ELSE
      FOR v_item IN SELECT * FROM jsonb_array_elements(NEW.items) LOOP
        BEGIN
          FOR v_cogs_result IN SELECT * FROM deduct_stock_fifo((v_item->>'productId')::UUID, (v_item->>'variantId')::UUID, ABS((v_item->>'quantity')::NUMERIC)) LOOP
            v_total_cogs := v_total_cogs + v_cogs_result.total_cogs;
          END LOOP;
        EXCEPTION WHEN OTHERS THEN
          v_total_cogs := v_total_cogs + ((v_item->>'price')::NUMERIC * ABS((v_item->>'quantity')::NUMERIC) * 0.7);
        END;
      END LOOP;
    END IF;
  END IF;

  IF v_is_refund THEN
    v_total_debit := v_abs_subtotal + v_abs_tax;
    v_total_credit := v_abs_subtotal + v_abs_tax;
  ELSE
    v_total_debit := v_abs_total + v_abs_discount + v_total_cogs;
    v_total_credit := v_abs_subtotal + v_abs_tax + v_total_cogs;
  END IF;

  INSERT INTO journal_entries (description, entry_date, reference, total_debit, total_credit, transaction_amount, status, created_by, posted_by, posted_at)
  VALUES (CASE WHEN v_is_refund THEN 'POS Refund - ' ELSE 'POS Sale - ' END || NEW.transaction_number, CURRENT_DATE, NEW.transaction_number, v_total_debit, v_total_credit, v_abs_total, 'posted', NEW.cashier_id, NEW.cashier_id, NOW())
  RETURNING id INTO v_journal_entry_id;

  CASE NEW.payment_method
    WHEN 'cash' THEN v_payment_account_id := v_cash_account_id;
    WHEN 'mobile_money' THEN v_payment_account_id := v_mobile_money_account_id;
    WHEN 'card' THEN v_payment_account_id := v_cash_account_id;
    WHEN 'credit' THEN v_payment_account_id := v_customer_ledger_id;
    WHEN 'exchange' THEN v_payment_account_id := NULL;
    ELSE v_payment_account_id := v_cash_account_id;
  END CASE;

  IF v_is_refund THEN
    IF v_abs_subtotal > 0 THEN INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount) VALUES (v_journal_entry_id, v_sales_account_id, 'Refund revenue', v_abs_subtotal, 0); END IF;
    IF v_abs_tax > 0 THEN INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount) VALUES (v_journal_entry_id, v_tax_account_id, 'Refund tax', v_abs_tax, 0); END IF;
    IF NEW.payment_method = 'credit' AND v_customer_ledger_id IS NOT NULL THEN
      IF v_abs_total > 0 THEN INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount) VALUES (v_journal_entry_id, v_customer_ledger_id, 'Refund to customer account', 0, v_abs_total); END IF;
    ELSIF v_payment_account_id IS NOT NULL AND v_abs_total > 0 THEN
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount) VALUES (v_journal_entry_id, v_payment_account_id, 'Refund payment', 0, v_abs_total);
    END IF;
  ELSE
    IF NEW.payment_method = 'credit' AND v_customer_ledger_id IS NOT NULL THEN
      IF v_abs_total > 0 THEN INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount) VALUES (v_journal_entry_id, v_customer_ledger_id, 'Sale on credit', v_abs_total, 0); END IF;
    ELSIF v_payment_account_id IS NOT NULL AND v_abs_total > 0 THEN
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount) VALUES (v_journal_entry_id, v_payment_account_id, 'Cash/payment received', v_abs_total, 0);
    END IF;
    IF v_abs_discount > 0 THEN INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount) VALUES (v_journal_entry_id, v_discount_account_id, 'Sales discount', v_abs_discount, 0); END IF;
    IF v_abs_subtotal > 0 THEN INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount) VALUES (v_journal_entry_id, v_sales_account_id, 'Sales revenue', 0, v_abs_subtotal); END IF;
    IF v_abs_tax > 0 THEN INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount) VALUES (v_journal_entry_id, v_tax_account_id, 'Sales tax', 0, v_abs_tax); END IF;
    IF v_total_cogs > 0 THEN
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount) VALUES (v_journal_entry_id, v_cogs_account_id, 'Cost of goods sold', v_total_cogs, 0);
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount) VALUES (v_journal_entry_id, v_inventory_account_id, 'Inventory reduction', 0, v_total_cogs);
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- 2. Update purchase journal entry function
CREATE OR REPLACE FUNCTION public.create_purchase_journal_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_inventory_account_id UUID;
  v_cash_account_id UUID;
  v_mobile_money_account_id UUID;
  v_payable_account_id UUID;
  v_supplier_ledger_id UUID;
  v_journal_entry_id UUID;
  v_payment_account_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM journal_entries WHERE reference = OLD.purchase_number AND description = 'Purchase - ' || OLD.purchase_number;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    DELETE FROM journal_entries WHERE reference = OLD.purchase_number AND description = 'Purchase - ' || OLD.purchase_number;
  END IF;

  -- Get account IDs - handle merged cash accounts (1010/1110)
  SELECT id INTO v_inventory_account_id FROM accounts WHERE account_code = '1020' LIMIT 1;
  SELECT id INTO v_cash_account_id FROM accounts WHERE account_code IN ('1010', '1110') AND is_active = true LIMIT 1;
  SELECT id INTO v_mobile_money_account_id FROM accounts WHERE account_code = '1015' LIMIT 1;
  SELECT id INTO v_payable_account_id FROM accounts WHERE account_code = '2010' LIMIT 1;

  SELECT supplier_ledger_account_id INTO v_supplier_ledger_id FROM contacts WHERE name = NEW.supplier_name AND is_supplier = true LIMIT 1;

  INSERT INTO journal_entries (description, entry_date, reference, total_debit, total_credit, status, created_by, posted_by, posted_at)
  VALUES ('Purchase - ' || NEW.purchase_number, CURRENT_DATE, NEW.purchase_number, NEW.total_amount, NEW.total_amount, 'posted', NEW.purchased_by, NEW.purchased_by, NOW())
  RETURNING id INTO v_journal_entry_id;

  INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
  VALUES (v_journal_entry_id, v_inventory_account_id, 'Inventory Purchase from ' || NEW.supplier_name, NEW.total_amount, 0);

  IF NEW.payment_status = 'paid' THEN
    IF NEW.payment_method = 'mobile_money' THEN v_payment_account_id := v_mobile_money_account_id;
    ELSE v_payment_account_id := v_cash_account_id; END IF;
  ELSE v_payment_account_id := COALESCE(v_supplier_ledger_id, v_payable_account_id); END IF;

  INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
  VALUES (v_journal_entry_id, v_payment_account_id, CASE WHEN NEW.payment_status = 'paid' THEN 'Payment - ' || NEW.payment_method ELSE 'Accounts Payable - ' || NEW.supplier_name END, 0, NEW.total_amount);

  RETURN NEW;
END;
$function$;

-- 3. Update payment receipt journal entry function
CREATE OR REPLACE FUNCTION public.create_payment_receipt_journal_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_je_id uuid;
  v_customer_account_id uuid;
  v_payment_account_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM journal_entries WHERE reference = OLD.receipt_number;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    UPDATE journal_entries SET entry_date = NEW.payment_date, description = 'Payment Receipt - ' || NEW.receipt_number, total_debit = NEW.amount, total_credit = NEW.amount, updated_at = now()
    WHERE reference = OLD.receipt_number RETURNING id INTO v_je_id;

    IF v_je_id IS NOT NULL THEN
      SELECT customer_ledger_account_id INTO v_customer_account_id FROM contacts WHERE id = NEW.contact_id;
      
      -- Get payment account - handle merged cash accounts (1010/1110)
      SELECT id INTO v_payment_account_id FROM accounts 
      WHERE account_name = CASE NEW.payment_method WHEN 'cash' THEN 'Cash' WHEN 'card' THEN 'Bank Account' WHEN 'mobile_money' THEN 'Mobile Money' ELSE 'Cash' END 
      LIMIT 1;

      DELETE FROM journal_entry_lines WHERE journal_entry_id = v_je_id;
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description) VALUES (v_je_id, v_payment_account_id, NEW.amount, 0, 'Payment method: ' || NEW.payment_method);
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description) VALUES (v_je_id, v_customer_account_id, 0, NEW.amount, 'Payment from customer');
    END IF;
    RETURN NEW;
  END IF;

  SELECT customer_ledger_account_id INTO v_customer_account_id FROM contacts WHERE id = NEW.contact_id;
  IF v_customer_account_id IS NULL THEN RAISE EXCEPTION 'Customer ledger account not found for contact %', NEW.contact_id; END IF;

  SELECT id INTO v_payment_account_id FROM accounts 
  WHERE account_name = CASE NEW.payment_method WHEN 'cash' THEN 'Cash' WHEN 'card' THEN 'Bank Account' WHEN 'mobile_money' THEN 'Mobile Money' ELSE 'Cash' END 
  LIMIT 1;

  INSERT INTO journal_entries (entry_date, description, reference, total_debit, total_credit, status, posted_at, posted_by, created_by)
  VALUES (NEW.payment_date, 'Payment Receipt - ' || NEW.receipt_number, NEW.receipt_number, NEW.amount, NEW.amount, 'posted', now(), NEW.received_by, NEW.received_by)
  RETURNING id INTO v_je_id;

  INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description) VALUES (v_je_id, v_payment_account_id, NEW.amount, 0, 'Payment method: ' || NEW.payment_method);
  INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description) VALUES (v_je_id, v_customer_account_id, 0, NEW.amount, 'Payment from customer');

  RETURN NEW;
END;
$function$;

-- 4. Update supplier payment journal entry function
CREATE OR REPLACE FUNCTION public.create_supplier_payment_journal_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_je_id uuid;
  v_supplier_account_id uuid;
  v_payment_account_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM journal_entries WHERE reference = OLD.payment_number;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    UPDATE journal_entries SET entry_date = NEW.payment_date, description = 'Supplier Payment - ' || NEW.payment_number, total_debit = NEW.amount, total_credit = NEW.amount, updated_at = now()
    WHERE reference = OLD.payment_number RETURNING id INTO v_je_id;

    IF v_je_id IS NOT NULL THEN
      SELECT supplier_ledger_account_id INTO v_supplier_account_id FROM contacts WHERE id = NEW.contact_id;
      
      -- Get payment account - handle merged cash accounts (1010/1110)
      SELECT id INTO v_payment_account_id FROM accounts 
      WHERE account_name = CASE NEW.payment_method WHEN 'cash' THEN 'Cash' WHEN 'card' THEN 'Bank Account' WHEN 'mobile_money' THEN 'Mobile Money' ELSE 'Cash' END 
      LIMIT 1;

      DELETE FROM journal_entry_lines WHERE journal_entry_id = v_je_id;
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description) VALUES (v_je_id, v_supplier_account_id, NEW.amount, 0, 'Payment to supplier');
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description) VALUES (v_je_id, v_payment_account_id, 0, NEW.amount, 'Payment method: ' || NEW.payment_method);
    END IF;
    RETURN NEW;
  END IF;

  SELECT supplier_ledger_account_id INTO v_supplier_account_id FROM contacts WHERE id = NEW.contact_id;
  IF v_supplier_account_id IS NULL THEN RAISE EXCEPTION 'Supplier ledger account not found for contact %', NEW.contact_id; END IF;

  SELECT id INTO v_payment_account_id FROM accounts 
  WHERE account_name = CASE NEW.payment_method WHEN 'cash' THEN 'Cash' WHEN 'card' THEN 'Bank Account' WHEN 'mobile_money' THEN 'Mobile Money' ELSE 'Cash' END 
  LIMIT 1;

  INSERT INTO journal_entries (entry_date, description, reference, total_debit, total_credit, status, posted_at, posted_by, created_by)
  VALUES (NEW.payment_date, 'Supplier Payment - ' || NEW.payment_number, NEW.payment_number, NEW.amount, NEW.amount, 'posted', now(), NEW.paid_by, NEW.paid_by)
  RETURNING id INTO v_je_id;

  INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description) VALUES (v_je_id, v_supplier_account_id, NEW.amount, 0, 'Payment to supplier');
  INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description) VALUES (v_je_id, v_payment_account_id, 0, NEW.amount, 'Payment method: ' || NEW.payment_method);

  RETURN NEW;
END;
$function$;