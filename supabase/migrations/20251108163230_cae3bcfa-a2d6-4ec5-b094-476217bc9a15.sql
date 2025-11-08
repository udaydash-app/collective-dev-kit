-- Fix journal entry balance calculation for refunds and sales
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
  -- Handle DELETE
  IF TG_OP = 'DELETE' THEN
    DELETE FROM journal_entries 
    WHERE reference = OLD.transaction_number 
      AND description LIKE 'POS%' || OLD.transaction_number;
    RETURN OLD;
  END IF;

  -- Handle UPDATE
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM journal_entries 
    WHERE reference = OLD.transaction_number 
      AND description LIKE 'POS%' || OLD.transaction_number;
  END IF;

  -- Check if this is a refund transaction
  v_is_refund := (NEW.metadata IS NOT NULL AND (NEW.metadata->>'is_refund')::boolean = true) OR NEW.total < 0;

  -- Use absolute values for calculations
  v_abs_total := ABS(NEW.total);
  v_abs_subtotal := ABS(NEW.subtotal);
  v_abs_discount := ABS(NEW.discount);
  v_abs_tax := ABS(NEW.tax);

  -- Check if journal entry already exists
  SELECT COUNT(*) INTO v_existing_entry_count
  FROM journal_entries
  WHERE reference = NEW.transaction_number
    AND description LIKE 'POS%' || NEW.transaction_number;

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
  SELECT id INTO v_cogs_account_id FROM accounts WHERE account_code = '5010' LIMIT 1;
  SELECT id INTO v_inventory_account_id FROM accounts WHERE account_code = '1020' LIMIT 1;

  -- Get customer ledger account if customer is linked
  IF NEW.customer_id IS NOT NULL THEN
    SELECT customer_ledger_account_id INTO v_customer_ledger_id
    FROM contacts
    WHERE id = NEW.customer_id;
  END IF;

  -- Skip COGS calculation for refunds
  IF NOT v_is_refund THEN
    IF NEW.metadata IS NOT NULL AND NEW.metadata ? 'total_cogs' THEN
      v_total_cogs := (NEW.metadata->>'total_cogs')::NUMERIC;
    ELSE
      FOR v_item IN SELECT * FROM jsonb_array_elements(NEW.items)
      LOOP
        BEGIN
          FOR v_cogs_result IN 
            SELECT * FROM deduct_stock_fifo(
              (v_item->>'productId')::UUID,
              (v_item->>'variantId')::UUID,
              ABS((v_item->>'quantity')::NUMERIC)
            )
          LOOP
            v_total_cogs := v_total_cogs + v_cogs_result.total_cogs;
          END LOOP;
        EXCEPTION
          WHEN OTHERS THEN
            v_total_cogs := v_total_cogs + ((v_item->>'price')::NUMERIC * ABS((v_item->>'quantity')::NUMERIC) * 0.7);
        END;
      END LOOP;
    END IF;
  END IF;

  -- Calculate balanced debits and credits
  IF v_is_refund THEN
    -- For refunds: Debits = subtotal + tax, Credits = total + discount
    v_total_debit := v_abs_subtotal + v_abs_tax;
    v_total_credit := v_abs_subtotal + v_abs_tax;
  ELSE
    -- For sales: Debits = total + discount + COGS, Credits = subtotal + tax + COGS
    v_total_debit := v_abs_total + v_abs_discount + v_total_cogs;
    v_total_credit := v_abs_subtotal + v_abs_tax + v_total_cogs;
  END IF;

  -- Create journal entry with balanced debits and credits
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
    CASE WHEN v_is_refund THEN 'POS Refund - ' ELSE 'POS Sale - ' END || NEW.transaction_number,
    CURRENT_DATE,
    NEW.transaction_number,
    v_total_debit,
    v_total_credit,
    NEW.total,
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

  -- For refunds, reverse the debit/credit entries
  IF v_is_refund THEN
    -- Refund: Credit cash/payment method (reduces cash)
    IF v_payment_account_id IS NOT NULL THEN
      INSERT INTO journal_entry_lines (
        journal_entry_id, account_id, description, debit_amount, credit_amount
      ) VALUES (
        v_journal_entry_id, v_payment_account_id, 'POS Refund - ' || NEW.payment_method, 0, v_abs_total
      );
    END IF;

    -- Refund: Debit sales (reduces revenue)
    INSERT INTO journal_entry_lines (
      journal_entry_id, account_id, description, debit_amount, credit_amount
    ) VALUES (
      v_journal_entry_id, v_sales_account_id, 'Sales Refund', v_abs_subtotal, 0
    );

    -- Refund: Debit tax liability (reduces tax owed)
    IF v_abs_tax > 0 THEN
      INSERT INTO journal_entry_lines (
        journal_entry_id, account_id, description, debit_amount, credit_amount
      ) VALUES (
        v_journal_entry_id, v_tax_account_id, 'Tax Refund', v_abs_tax, 0
      );
    END IF;

    -- Refund: Credit discount (reverses discount given) - only if discount was applied
    IF v_abs_discount > 0 AND v_discount_account_id IS NOT NULL THEN
      INSERT INTO journal_entry_lines (
        journal_entry_id, account_id, description, debit_amount, credit_amount
      ) VALUES (
        v_journal_entry_id, v_discount_account_id, 'Discount Reversal', 0, v_abs_discount
      );
    END IF;

  ELSE
    -- Normal sale entries
    IF v_customer_ledger_id IS NOT NULL THEN
      INSERT INTO journal_entry_lines (
        journal_entry_id, account_id, description, debit_amount, credit_amount
      ) VALUES (
        v_journal_entry_id, v_customer_ledger_id, 'Sale to customer', v_abs_total, 0
      );

      INSERT INTO journal_entry_lines (
        journal_entry_id, account_id, description, debit_amount, credit_amount
      ) VALUES (
        v_journal_entry_id, v_sales_account_id, 'Sales Revenue', 0, v_abs_subtotal
      );

      IF NEW.payment_method != 'credit' AND v_payment_account_id IS NOT NULL THEN
        INSERT INTO journal_entry_lines (
          journal_entry_id, account_id, description, debit_amount, credit_amount
        ) VALUES (
          v_journal_entry_id, v_payment_account_id, 'Payment received - ' || NEW.payment_method, v_abs_total, 0
        );

        INSERT INTO journal_entry_lines (
          journal_entry_id, account_id, description, debit_amount, credit_amount
        ) VALUES (
          v_journal_entry_id, v_customer_ledger_id, 'Payment received - ' || NEW.payment_method, 0, v_abs_total
        );
      END IF;
    ELSE
      IF v_payment_account_id IS NOT NULL THEN
        INSERT INTO journal_entry_lines (
          journal_entry_id, account_id, description, debit_amount, credit_amount
        ) VALUES (
          v_journal_entry_id, v_payment_account_id, 'POS Sale - ' || NEW.payment_method, v_abs_total, 0
        );
      ELSE
        INSERT INTO journal_entry_lines (
          journal_entry_id, account_id, description, debit_amount, credit_amount
        ) VALUES (
          v_journal_entry_id, v_ar_account_id, 'POS Sale - credit', v_abs_total, 0
        );
      END IF;

      INSERT INTO journal_entry_lines (
        journal_entry_id, account_id, description, debit_amount, credit_amount
      ) VALUES (
        v_journal_entry_id, v_sales_account_id, 'Sales Revenue', 0, v_abs_subtotal
      );
    END IF;

    IF v_abs_tax > 0 THEN
      INSERT INTO journal_entry_lines (
        journal_entry_id, account_id, description, debit_amount, credit_amount
      ) VALUES (
        v_journal_entry_id, v_tax_account_id, 'Sales Tax Collected', 0, v_abs_tax
      );
    END IF;

    IF v_abs_discount > 0 AND v_discount_account_id IS NOT NULL THEN
      INSERT INTO journal_entry_lines (
        journal_entry_id, account_id, description, debit_amount, credit_amount
      ) VALUES (
        v_journal_entry_id, v_discount_account_id, 'Sales Discount', v_abs_discount, 0
      );
    END IF;

    IF v_total_cogs > 0 AND v_cogs_account_id IS NOT NULL AND v_inventory_account_id IS NOT NULL THEN
      INSERT INTO journal_entry_lines (
        journal_entry_id, account_id, description, debit_amount, credit_amount
      ) VALUES (
        v_journal_entry_id, v_cogs_account_id, 'Cost of Goods Sold', v_total_cogs, 0
      );

      INSERT INTO journal_entry_lines (
        journal_entry_id, account_id, description, debit_amount, credit_amount
      ) VALUES (
        v_journal_entry_id, v_inventory_account_id, 'Inventory Reduction', 0, v_total_cogs
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;