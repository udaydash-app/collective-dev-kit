
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
  v_masked_entry_id UUID;
  v_payment_account_id UUID;
  v_payment RECORD;
  v_payment_details JSONB;
  v_is_refund BOOLEAN;
  v_auth_user_id UUID;
  v_variant TEXT;
  v_prefix TEXT;
  v_total NUMERIC;
  v_subtotal NUMERIC;
  v_tax NUMERIC;
  v_discount NUMERIC;
  v_abs_total NUMERIC;
  v_sales_amount NUMERIC;
  v_ratio NUMERIC;
  v_entry_id UUID;
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

  v_auth_user_id := public.resolve_auth_user_id(NEW.cashier_id);
  v_payment_details := COALESCE(NEW.payment_details::JSONB, '[]'::JSONB);
  v_is_refund := COALESCE(NEW.total, 0) < 0;
  v_prefix := CASE WHEN v_is_refund THEN 'Remboursement POS - ' ELSE 'Vente POS - ' END;

  FOR v_variant IN SELECT unnest(ARRAY['masked','real']) LOOP
    IF v_variant = 'masked' THEN
      v_total    := COALESCE(NEW.total, 0);
      v_subtotal := COALESCE(NEW.subtotal, 0);
      v_tax      := COALESCE(NEW.tax, 0);
      v_discount := COALESCE(NEW.discount, 0);
    ELSE
      v_total    := COALESCE(NEW.real_total, NEW.total, 0);
      v_subtotal := COALESCE(NEW.real_subtotal, NEW.subtotal, 0);
      v_tax      := COALESCE(NEW.real_tax, NEW.tax, 0);
      v_discount := COALESCE(NEW.real_discount, NEW.discount, 0);
    END IF;

    v_abs_total    := ABS(v_total);
    v_sales_amount := ABS(v_subtotal) + ABS(v_discount);

    INSERT INTO journal_entries (
      description, entry_date, reference, total_debit, total_credit,
      transaction_amount, status, created_by, posted_by, posted_at,
      is_real_ledger, masked_entry_id
    ) VALUES (
      v_prefix || NEW.transaction_number,
      COALESCE(NEW.created_at, NOW())::date, NEW.transaction_number,
      v_abs_total + ABS(v_discount), v_abs_total + ABS(v_discount),
      v_total, 'posted', v_auth_user_id, v_auth_user_id, NOW(),
      v_variant = 'real',
      CASE WHEN v_variant = 'real' THEN v_masked_entry_id ELSE NULL END
    ) RETURNING id INTO v_entry_id;

    IF v_variant = 'masked' THEN v_masked_entry_id := v_entry_id; END IF;

    v_ratio := CASE
      WHEN v_variant = 'real' AND COALESCE(NEW.total, 0) <> 0
        THEN v_total / NEW.total
      ELSE 1
    END;

    IF jsonb_array_length(v_payment_details) > 0 THEN
      FOR v_payment IN SELECT * FROM jsonb_array_elements(v_payment_details)
      LOOP
        DECLARE
          v_method TEXT := COALESCE(v_payment.value->>'method', 'cash');
          v_amount NUMERIC := ABS(COALESCE((v_payment.value->>'amount')::NUMERIC, 0)) * v_ratio;
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
                VALUES (v_entry_id, v_payment_account_id,
                  CASE v_method WHEN 'cash' THEN 'Remboursement espèces' WHEN 'mobile_money' THEN 'Remboursement Mobile Money' WHEN 'credit' THEN 'Réduction crédit client' ELSE 'Remboursement - ' || v_method END,
                  0, v_amount);
              ELSE
                INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
                VALUES (v_entry_id, v_payment_account_id,
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
          VALUES (v_entry_id, v_cash_account_id, 'Remboursement espèces', 0, v_abs_total);
        ELSE
          INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
          VALUES (v_entry_id, v_cash_account_id, 'Encaissement espèces', v_abs_total, 0);
        END IF;
      END IF;
    END IF;

    IF v_sales_amount > 0 AND v_sales_account_id IS NOT NULL THEN
      IF v_is_refund THEN
        INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
        VALUES (v_entry_id, v_sales_account_id, 'Annulation vente', v_sales_amount, 0);
      ELSE
        INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
        VALUES (v_entry_id, v_sales_account_id, 'Ventes de marchandises', 0, v_sales_amount);
      END IF;
    END IF;

    IF ABS(v_discount) > 0 AND v_discount_account_id IS NOT NULL THEN
      IF v_is_refund THEN
        INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
        VALUES (v_entry_id, v_discount_account_id, 'Annulation remise', 0, ABS(v_discount));
      ELSE
        INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
        VALUES (v_entry_id, v_discount_account_id, 'Remises accordées', ABS(v_discount), 0);
      END IF;
    END IF;

    IF ABS(v_tax) > 0 AND v_tax_account_id IS NOT NULL THEN
      IF v_is_refund THEN
        INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
        VALUES (v_entry_id, v_tax_account_id, 'Annulation timbre', ABS(v_tax), 0);
      ELSE
        INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
        VALUES (v_entry_id, v_tax_account_id, 'Timbre fiscal', 0, ABS(v_tax));
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_online_order_journal_entry()
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
  v_delivery_income_account_id UUID;
  v_ar_account_id UUID;
  v_customer_ledger_id UUID;
  v_masked_entry_id UUID;
  v_payment_account_id UUID;
  v_variant TEXT;
  v_entry_id UUID;
  v_total NUMERIC;
  v_subtotal NUMERIC;
  v_tax NUMERIC;
  v_discount NUMERIC;
  v_delivery_fee NUMERIC;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM journal_entries WHERE reference = OLD.order_number;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.payment_status = 'paid' THEN
    DELETE FROM journal_entries WHERE reference = NEW.order_number;

    SELECT id INTO v_cash_account_id FROM accounts WHERE account_code = '571' AND is_active = true LIMIT 1;
    SELECT id INTO v_mobile_money_account_id FROM accounts WHERE account_code = '521' LIMIT 1;
    SELECT id INTO v_sales_account_id FROM accounts WHERE account_code = '701' LIMIT 1;
    SELECT id INTO v_discount_account_id FROM accounts WHERE account_code = '709' LIMIT 1;
    SELECT id INTO v_tax_account_id FROM accounts WHERE account_code IN ('4471', '4431') ORDER BY CASE WHEN account_code = '4471' THEN 0 ELSE 1 END LIMIT 1;
    SELECT id INTO v_delivery_income_account_id FROM accounts WHERE account_code = '706' LIMIT 1;
    SELECT id INTO v_ar_account_id FROM accounts WHERE account_code = '411' LIMIT 1;

    IF NEW.customer_id IS NOT NULL THEN
      SELECT customer_ledger_account_id INTO v_customer_ledger_id FROM contacts WHERE id = NEW.customer_id;
    END IF;

    FOR v_variant IN SELECT unnest(ARRAY['masked','real']) LOOP
      IF v_variant = 'masked' THEN
        v_total    := COALESCE(NEW.total, 0);
        v_subtotal := COALESCE(NEW.subtotal, 0);
        v_tax      := COALESCE(NEW.tax, 0);
      ELSE
        v_total    := COALESCE(NEW.real_total, NEW.total, 0);
        v_subtotal := COALESCE(NEW.real_subtotal, NEW.subtotal, 0);
        v_tax      := COALESCE(NEW.real_tax, NEW.tax, 0);
      END IF;
      v_discount := GREATEST(v_subtotal + v_tax - v_total, 0);
      v_delivery_fee := GREATEST(v_total - v_subtotal - v_tax, 0);

      INSERT INTO journal_entries (
        description, entry_date, reference, total_debit, total_credit,
        transaction_amount, status, posted_at, is_real_ledger, masked_entry_id
      ) VALUES (
        'Vente en ligne - ' || NEW.order_number,
        COALESCE(NEW.created_at, NOW())::date,
        NEW.order_number,
        v_total + v_discount,
        v_subtotal + v_tax + v_delivery_fee,
        v_total, 'posted', NOW(),
        v_variant = 'real',
        CASE WHEN v_variant = 'real' THEN v_masked_entry_id ELSE NULL END
      ) RETURNING id INTO v_entry_id;

      IF v_variant = 'masked' THEN v_masked_entry_id := v_entry_id; END IF;

      CASE NEW.payment_method
        WHEN 'cash' THEN v_payment_account_id := v_cash_account_id;
        WHEN 'mobile_money' THEN v_payment_account_id := v_mobile_money_account_id;
        WHEN 'card' THEN v_payment_account_id := v_cash_account_id;
        WHEN 'credit' THEN v_payment_account_id := COALESCE(v_customer_ledger_id, v_ar_account_id);
        ELSE v_payment_account_id := v_cash_account_id;
      END CASE;

      IF v_payment_account_id IS NOT NULL AND v_total > 0 THEN
        INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
        VALUES (v_entry_id, v_payment_account_id,
          CASE WHEN NEW.payment_method = 'credit' THEN 'Vente à crédit' ELSE 'Paiement reçu - ' || COALESCE(NEW.payment_method, 'espèces') END,
          v_total, 0);
      END IF;

      IF v_discount > 0 AND v_discount_account_id IS NOT NULL THEN
        INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
        VALUES (v_entry_id, v_discount_account_id, 'Remise commande en ligne', v_discount, 0);
      END IF;

      IF v_subtotal > 0 AND v_sales_account_id IS NOT NULL THEN
        INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
        VALUES (v_entry_id, v_sales_account_id, 'Ventes de marchandises', 0, v_subtotal);
      END IF;

      IF v_tax > 0 AND v_tax_account_id IS NOT NULL THEN
        INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
        VALUES (v_entry_id, v_tax_account_id, 'Timbre collecté', 0, v_tax);
      END IF;

      IF v_delivery_fee > 0 AND COALESCE(v_delivery_income_account_id, v_sales_account_id) IS NOT NULL THEN
        INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
        VALUES (v_entry_id, COALESCE(v_delivery_income_account_id, v_sales_account_id), 'Delivery revenue', 0, v_delivery_fee);
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$;

UPDATE journal_entries SET is_real_ledger = false WHERE is_real_ledger IS NULL;
