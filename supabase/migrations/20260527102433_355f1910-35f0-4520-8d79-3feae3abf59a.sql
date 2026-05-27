CREATE OR REPLACE FUNCTION public.resolve_auth_user_id(p_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_id IS NULL THEN NULL
    WHEN EXISTS (SELECT 1 FROM auth.users WHERE id = p_id) THEN p_id
    ELSE (SELECT user_id FROM public.pos_users WHERE id = p_id LIMIT 1)
  END;
$$;

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
  v_payment RECORD;
  v_payment_details JSONB;
  v_total_amount NUMERIC;
  v_sales_amount NUMERIC;
  v_discount_amount NUMERIC;
  v_tax_amount NUMERIC;
  v_is_refund BOOLEAN;
  v_abs_total NUMERIC;
  v_auth_user_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM journal_entries WHERE reference = OLD.transaction_number;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    DELETE FROM journal_entries WHERE reference = OLD.transaction_number;
  END IF;

  SELECT id INTO v_cash_account_id FROM accounts WHERE account_code = '571' AND is_active = true LIMIT 1;
  SELECT id INTO v_mobile_money_account_id FROM accounts WHERE account_code = '521' AND is_active = true LIMIT 1;
  SELECT id INTO v_sales_account_id FROM accounts WHERE account_code = '701' AND is_active = true LIMIT 1;
  SELECT id INTO v_discount_account_id FROM accounts WHERE account_code = '709' AND is_active = true LIMIT 1;
  SELECT id INTO v_tax_account_id FROM accounts WHERE account_code = '4471' AND is_active = true LIMIT 1;
  SELECT id INTO v_ar_account_id FROM accounts WHERE account_code = '411' AND is_active = true LIMIT 1;

  IF NEW.customer_id IS NOT NULL THEN
    SELECT customer_ledger_account_id INTO v_customer_ledger_id FROM contacts WHERE id = NEW.customer_id;
  END IF;

  v_total_amount := COALESCE(NEW.total, 0);
  v_is_refund := v_total_amount < 0;
  v_abs_total := ABS(v_total_amount);
  v_discount_amount := ABS(COALESCE(NEW.discount, 0));
  v_tax_amount := ABS(COALESCE(NEW.tax, 0));
  v_sales_amount := ABS(COALESCE(NEW.subtotal, 0)) + v_discount_amount;

  -- Resolve cashier_id (may be a pos_users.id from offline) to a valid auth.users.id
  v_auth_user_id := public.resolve_auth_user_id(NEW.cashier_id);

  INSERT INTO journal_entries (
    description, entry_date, reference, total_debit, total_credit,
    transaction_amount, status, created_by, posted_by, posted_at
  ) VALUES (
    CASE WHEN v_is_refund THEN 'Remboursement POS - ' ELSE 'Vente POS - ' END || NEW.transaction_number,
    CURRENT_DATE, NEW.transaction_number,
    v_abs_total + v_discount_amount, v_abs_total + v_discount_amount,
    v_total_amount, 'posted', v_auth_user_id, v_auth_user_id, NOW()
  ) RETURNING id INTO v_journal_entry_id;

  v_payment_details := COALESCE(NEW.payment_details::JSONB, '[]'::JSONB);

  IF jsonb_array_length(v_payment_details) > 0 THEN
    FOR v_payment IN SELECT * FROM jsonb_array_elements(v_payment_details)
    LOOP
      DECLARE
        v_method TEXT := COALESCE(v_payment.value->>'method', 'cash');
        v_amount NUMERIC := ABS(COALESCE((v_payment.value->>'amount')::NUMERIC, 0));
      BEGIN
        IF v_amount > 0 THEN
          IF v_method = 'mobile_money' THEN
            v_payment_account_id := v_mobile_money_account_id;
          ELSIF v_method = 'credit' THEN
            v_payment_account_id := COALESCE(v_customer_ledger_id, v_ar_account_id);
          ELSE
            v_payment_account_id := v_cash_account_id;
          END IF;

          IF v_payment_account_id IS NOT NULL THEN
            IF v_is_refund THEN
              INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
              VALUES (v_journal_entry_id, v_payment_account_id,
                CASE v_method WHEN 'cash' THEN 'Remboursement espèces' WHEN 'mobile_money' THEN 'Remboursement Mobile Money' WHEN 'credit' THEN 'Réduction crédit client' ELSE 'Remboursement - ' || v_method END,
                0, v_amount);
            ELSE
              INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
              VALUES (v_journal_entry_id, v_payment_account_id,
                CASE v_method WHEN 'cash' THEN 'Encaissement espèces' WHEN 'mobile_money' THEN 'Encaissement Mobile Money' WHEN 'credit' THEN 'Vente à crédit' ELSE 'Encaissement - ' || v_method END,
                v_amount, 0);
            END IF;
          END IF;
        END IF;
      END;
    END LOOP;
  ELSE
    IF v_abs_total > 0 AND v_cash_account_id IS NOT NULL THEN
      IF v_is_refund THEN
        INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
        VALUES (v_journal_entry_id, v_cash_account_id, 'Remboursement espèces', 0, v_abs_total);
      ELSE
        INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
        VALUES (v_journal_entry_id, v_cash_account_id, 'Encaissement espèces', v_abs_total, 0);
      END IF;
    END IF;
  END IF;

  IF v_sales_amount > 0 AND v_sales_account_id IS NOT NULL THEN
    IF v_is_refund THEN
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
      VALUES (v_journal_entry_id, v_sales_account_id, 'Annulation vente', v_sales_amount, 0);
    ELSE
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
      VALUES (v_journal_entry_id, v_sales_account_id, 'Ventes de marchandises', 0, v_sales_amount);
    END IF;
  END IF;

  IF v_discount_amount > 0 AND v_discount_account_id IS NOT NULL THEN
    IF v_is_refund THEN
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
      VALUES (v_journal_entry_id, v_discount_account_id, 'Annulation remise', 0, v_discount_amount);
    ELSE
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
      VALUES (v_journal_entry_id, v_discount_account_id, 'Remises accordées', v_discount_amount, 0);
    END IF;
  END IF;

  IF v_tax_amount > 0 AND v_tax_account_id IS NOT NULL THEN
    IF v_is_refund THEN
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
      VALUES (v_journal_entry_id, v_tax_account_id, 'Annulation timbre', v_tax_amount, 0);
    ELSE
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
      VALUES (v_journal_entry_id, v_tax_account_id, 'Timbre fiscal', 0, v_tax_amount);
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_cash_register_opening_entry()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cash_account_id UUID;
  v_owner_cash_account_id UUID;
  v_journal_entry_id UUID;
  v_ref TEXT;
  v_auth_user_id UUID;
BEGIN
  IF NEW.opening_cash IS NULL OR NEW.opening_cash <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_cash_account_id FROM accounts WHERE account_code = '571' AND is_active = true LIMIT 1;
  SELECT id INTO v_owner_cash_account_id FROM accounts WHERE account_code = '5711' AND is_active = true LIMIT 1;

  IF v_cash_account_id IS NULL OR v_owner_cash_account_id IS NULL THEN
    RAISE WARNING 'Required accounts (571, 5711) not found for cash register opening';
    RETURN NEW;
  END IF;

  v_ref := 'REG-OPEN-' || UPPER(SUBSTRING(REPLACE(NEW.id::text, '-', '') FROM 1 FOR 8));
  v_auth_user_id := public.resolve_auth_user_id(NEW.cashier_id);

  INSERT INTO journal_entries (description, entry_date, reference, total_debit, total_credit, status, posted_at, created_by, posted_by)
  VALUES ('Cash Register Opening - Session ' || NEW.id, DATE(NEW.opened_at), v_ref, NEW.opening_cash, NEW.opening_cash, 'posted', NEW.opened_at, v_auth_user_id, v_auth_user_id)
  RETURNING id INTO v_journal_entry_id;

  INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
  VALUES (v_journal_entry_id, v_cash_account_id, 'Cash placed in register', NEW.opening_cash, 0);

  INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
  VALUES (v_journal_entry_id, v_owner_cash_account_id, 'Owner cash to register', 0, NEW.opening_cash);

  RETURN NEW;
END;
$function$;