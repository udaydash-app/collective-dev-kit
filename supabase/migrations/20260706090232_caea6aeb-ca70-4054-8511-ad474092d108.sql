-- Remove duplicated real-ledger copies where they are an exact duplicate of the visible journal entry.
-- This preserves the masked/normal entry and deletes only the linked duplicate copy.
DELETE FROM public.journal_entries real_entry
USING public.journal_entries masked_entry
WHERE real_entry.is_real_ledger = true
  AND real_entry.masked_entry_id = masked_entry.id
  AND masked_entry.is_real_ledger = false
  AND real_entry.reference = masked_entry.reference
  AND real_entry.total_debit = masked_entry.total_debit
  AND real_entry.total_credit = masked_entry.total_credit
  AND COALESCE(real_entry.transaction_amount, 0) = COALESCE(masked_entry.transaction_amount, 0);

-- Prevent duplicate normal system journal entries for the same source reference.
-- Manual entries can still reuse references because many historic manual notes intentionally share labels.
CREATE UNIQUE INDEX IF NOT EXISTS journal_entries_system_reference_normal_key
  ON public.journal_entries (reference)
  WHERE reference IS NOT NULL
    AND reference <> ''
    AND is_real_ledger = false
    AND (
      reference LIKE 'POS-%'
      OR reference LIKE 'ORD-%'
      OR reference LIKE 'EXP-%'
      OR reference LIKE 'PUR-%'
      OR reference LIKE 'PAY-%'
      OR reference LIKE 'REG-OPEN-%'
      OR reference LIKE 'REG-CLOSE-%'
    );

-- A linked real-ledger entry should be unique per masked entry if real-ledger mode is used again later.
CREATE UNIQUE INDEX IF NOT EXISTS journal_entries_real_masked_entry_key
  ON public.journal_entries (masked_entry_id)
  WHERE is_real_ledger = true AND masked_entry_id IS NOT NULL;

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
  v_payment_account_id UUID;
  v_payment RECORD;
  v_payment_details JSONB;
  v_is_refund BOOLEAN;
  v_auth_user_id UUID;
  v_prefix TEXT;
  v_total NUMERIC;
  v_subtotal NUMERIC;
  v_tax NUMERIC;
  v_discount NUMERIC;
  v_abs_total NUMERIC;
  v_sales_amount NUMERIC;
  v_entry_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.journal_entries WHERE reference = OLD.transaction_number;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    DELETE FROM public.journal_entries WHERE reference = OLD.transaction_number;
  END IF;

  SELECT id INTO v_cash_account_id FROM public.accounts WHERE account_code = '571' AND is_active = true LIMIT 1;
  SELECT id INTO v_mobile_money_account_id FROM public.accounts WHERE account_code = '521' AND is_active = true LIMIT 1;
  SELECT id INTO v_sales_account_id FROM public.accounts WHERE account_code = '701' AND is_active = true LIMIT 1;
  SELECT id INTO v_discount_account_id FROM public.accounts WHERE account_code = '709' AND is_active = true LIMIT 1;
  SELECT id INTO v_tax_account_id FROM public.accounts WHERE account_code = '4471' AND is_active = true LIMIT 1;
  SELECT id INTO v_ar_account_id FROM public.accounts WHERE account_code = '411' AND is_active = true LIMIT 1;

  IF NEW.customer_id IS NOT NULL THEN
    SELECT customer_ledger_account_id INTO v_customer_ledger_id FROM public.contacts WHERE id = NEW.customer_id;
  END IF;

  v_auth_user_id := public.resolve_auth_user_id(NEW.cashier_id);
  v_payment_details := COALESCE(NEW.payment_details::JSONB, '[]'::JSONB);
  v_is_refund := COALESCE(NEW.total, 0) < 0;
  v_prefix := CASE WHEN v_is_refund THEN 'Remboursement POS - ' ELSE 'Vente POS - ' END;

  -- Use one authoritative journal entry per POS transaction.
  -- Previously this loop wrote both masked and real copies, which showed as double entries.
  v_total    := COALESCE(NEW.total, 0);
  v_subtotal := COALESCE(NEW.subtotal, 0);
  v_tax      := COALESCE(NEW.tax, 0);
  v_discount := COALESCE(NEW.discount, 0);

  v_abs_total    := ABS(v_total);
  v_sales_amount := ABS(v_subtotal) + ABS(v_discount);

  INSERT INTO public.journal_entries (
    description, entry_date, reference, total_debit, total_credit,
    transaction_amount, status, created_by, posted_by, posted_at,
    is_real_ledger, masked_entry_id
  ) VALUES (
    v_prefix || NEW.transaction_number,
    COALESCE(NEW.created_at, NOW())::date, NEW.transaction_number,
    v_abs_total + ABS(v_discount), v_abs_total + ABS(v_discount),
    v_total, 'posted', v_auth_user_id, v_auth_user_id, NOW(),
    false, NULL
  )
  ON CONFLICT ON CONSTRAINT journal_entries_entry_number_key DO NOTHING
  RETURNING id INTO v_entry_id;

  IF v_entry_id IS NULL THEN
    SELECT id INTO v_entry_id
    FROM public.journal_entries
    WHERE reference = NEW.transaction_number AND is_real_ledger = false
    LIMIT 1;
  END IF;

  IF v_entry_id IS NULL THEN
    RETURN NEW;
  END IF;

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
              INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
              VALUES (v_entry_id, v_payment_account_id,
                CASE v_method WHEN 'cash' THEN 'Remboursement espèces' WHEN 'mobile_money' THEN 'Remboursement Mobile Money' WHEN 'credit' THEN 'Réduction crédit client' ELSE 'Remboursement - ' || v_method END,
                0, v_amount);
            ELSE
              INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
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
        INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
        VALUES (v_entry_id, v_cash_account_id, 'Remboursement espèces', 0, v_abs_total);
      ELSE
        INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
        VALUES (v_entry_id, v_cash_account_id, 'Encaissement espèces', v_abs_total, 0);
      END IF;
    END IF;
  END IF;

  IF v_sales_amount > 0 AND v_sales_account_id IS NOT NULL THEN
    IF v_is_refund THEN
      INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
      VALUES (v_entry_id, v_sales_account_id, 'Annulation vente', v_sales_amount, 0);
    ELSE
      INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
      VALUES (v_entry_id, v_sales_account_id, 'Ventes de marchandises', 0, v_sales_amount);
    END IF;
  END IF;

  IF ABS(v_discount) > 0 AND v_discount_account_id IS NOT NULL THEN
    IF v_is_refund THEN
      INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
      VALUES (v_entry_id, v_discount_account_id, 'Annulation remise', 0, ABS(v_discount));
    ELSE
      INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
      VALUES (v_entry_id, v_discount_account_id, 'Remises accordées', ABS(v_discount), 0);
    END IF;
  END IF;

  IF ABS(v_tax) > 0 AND v_tax_account_id IS NOT NULL THEN
    IF v_is_refund THEN
      INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
      VALUES (v_entry_id, v_tax_account_id, 'Annulation timbre', ABS(v_tax), 0);
    ELSE
      INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
      VALUES (v_entry_id, v_tax_account_id, 'Timbre fiscal', 0, ABS(v_tax));
    END IF;
  END IF;

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
  v_payment_account_id UUID;
  v_entry_id UUID;
  v_total NUMERIC;
  v_subtotal NUMERIC;
  v_tax NUMERIC;
  v_discount NUMERIC;
  v_delivery_fee NUMERIC;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.journal_entries WHERE reference = OLD.order_number;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.payment_status = 'paid' THEN
    DELETE FROM public.journal_entries WHERE reference = NEW.order_number;

    SELECT id INTO v_cash_account_id FROM public.accounts WHERE account_code = '571' AND is_active = true LIMIT 1;
    SELECT id INTO v_mobile_money_account_id FROM public.accounts WHERE account_code = '521' LIMIT 1;
    SELECT id INTO v_sales_account_id FROM public.accounts WHERE account_code = '701' LIMIT 1;
    SELECT id INTO v_discount_account_id FROM public.accounts WHERE account_code = '709' LIMIT 1;
    SELECT id INTO v_tax_account_id FROM public.accounts WHERE account_code IN ('4471', '4431') ORDER BY CASE WHEN account_code = '4471' THEN 0 ELSE 1 END LIMIT 1;
    SELECT id INTO v_delivery_income_account_id FROM public.accounts WHERE account_code = '706' LIMIT 1;
    SELECT id INTO v_ar_account_id FROM public.accounts WHERE account_code = '411' LIMIT 1;

    IF NEW.customer_id IS NOT NULL THEN
      SELECT customer_ledger_account_id INTO v_customer_ledger_id FROM public.contacts WHERE id = NEW.customer_id;
    END IF;

    -- Use one authoritative journal entry per online order.
    v_total    := COALESCE(NEW.total, 0);
    v_subtotal := COALESCE(NEW.subtotal, 0);
    v_tax      := COALESCE(NEW.tax, 0);
    v_discount := GREATEST(v_subtotal + v_tax - v_total, 0);
    v_delivery_fee := GREATEST(v_total - v_subtotal - v_tax, 0);

    INSERT INTO public.journal_entries (
      description, entry_date, reference, total_debit, total_credit,
      transaction_amount, status, posted_at, is_real_ledger, masked_entry_id
    ) VALUES (
      'Vente en ligne - ' || NEW.order_number,
      COALESCE(NEW.created_at, NOW())::date,
      NEW.order_number,
      v_total + v_discount,
      v_subtotal + v_tax + v_delivery_fee,
      v_total, 'posted', NOW(), false, NULL
    ) RETURNING id INTO v_entry_id;

    CASE NEW.payment_method
      WHEN 'cash' THEN v_payment_account_id := v_cash_account_id;
      WHEN 'mobile_money' THEN v_payment_account_id := v_mobile_money_account_id;
      WHEN 'card' THEN v_payment_account_id := v_cash_account_id;
      WHEN 'credit' THEN v_payment_account_id := COALESCE(v_customer_ledger_id, v_ar_account_id);
      ELSE v_payment_account_id := v_cash_account_id;
    END CASE;

    IF v_payment_account_id IS NOT NULL AND v_total > 0 THEN
      INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
      VALUES (v_entry_id, v_payment_account_id,
        CASE WHEN NEW.payment_method = 'credit' THEN 'Vente à crédit' ELSE 'Paiement reçu - ' || COALESCE(NEW.payment_method, 'espèces') END,
        v_total, 0);
    END IF;

    IF v_discount > 0 AND v_discount_account_id IS NOT NULL THEN
      INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
      VALUES (v_entry_id, v_discount_account_id, 'Remise commande en ligne', v_discount, 0);
    END IF;

    IF v_subtotal > 0 AND v_sales_account_id IS NOT NULL THEN
      INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
      VALUES (v_entry_id, v_sales_account_id, 'Ventes de marchandises', 0, v_subtotal);
    END IF;

    IF v_tax > 0 AND v_tax_account_id IS NOT NULL THEN
      INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
      VALUES (v_entry_id, v_tax_account_id, 'Timbre collecté', 0, v_tax);
    END IF;

    IF v_delivery_fee > 0 AND COALESCE(v_delivery_income_account_id, v_sales_account_id) IS NOT NULL THEN
      INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
      VALUES (v_entry_id, COALESCE(v_delivery_income_account_id, v_sales_account_id), 'Delivery revenue', 0, v_delivery_fee);
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;