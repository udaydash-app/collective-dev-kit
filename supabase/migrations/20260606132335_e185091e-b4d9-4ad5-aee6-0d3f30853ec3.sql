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
  v_auth_user_id := public.resolve_auth_user_id(NEW.cashier_id);

  INSERT INTO journal_entries (
    description, entry_date, reference, total_debit, total_credit,
    transaction_amount, status, created_by, posted_by, posted_at
  ) VALUES (
    CASE WHEN v_is_refund THEN 'Remboursement POS - ' ELSE 'Vente POS - ' END || NEW.transaction_number,
    COALESCE(NEW.created_at, NOW())::date, NEW.transaction_number,
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
  v_customs_account_id UUID;
  v_journal_entry_id UUID;
  v_payment_account_id UUID;
  v_total_local_charges NUMERIC := 0;
  v_cif_amount NUMERIC;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM journal_entries WHERE reference = OLD.purchase_number AND description LIKE 'Achat - %';
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    DELETE FROM journal_entries WHERE reference = OLD.purchase_number AND description LIKE 'Achat - %';
  END IF;

  SELECT id INTO v_inventory_account_id FROM accounts WHERE account_code = '31' LIMIT 1;
  SELECT id INTO v_cash_account_id FROM accounts WHERE account_code = '571' AND is_active = true LIMIT 1;
  SELECT id INTO v_mobile_money_account_id FROM accounts WHERE account_code = '521' LIMIT 1;
  SELECT id INTO v_payable_account_id FROM accounts WHERE account_code = '401' LIMIT 1;
  SELECT id INTO v_customs_account_id FROM accounts WHERE account_code = '6584' LIMIT 1;

  SELECT supplier_ledger_account_id INTO v_supplier_ledger_id 
  FROM contacts WHERE name = NEW.supplier_name AND is_supplier = true LIMIT 1;

  SELECT COALESCE(SUM(COALESCE(local_charges, 0) * quantity), 0)
  INTO v_total_local_charges
  FROM purchase_items WHERE purchase_id = NEW.id;

  v_cif_amount := NEW.total_amount - v_total_local_charges;

  INSERT INTO journal_entries (description, entry_date, reference, total_debit, total_credit, status, created_by, posted_by, posted_at)
  VALUES ('Achat - ' || NEW.purchase_number, COALESCE(NEW.purchased_at, NOW())::date, NEW.purchase_number, NEW.total_amount, NEW.total_amount, 'posted', NEW.purchased_by, NEW.purchased_by, NOW())
  RETURNING id INTO v_journal_entry_id;

  INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
  VALUES (v_journal_entry_id, v_inventory_account_id, 'Achat marchandises - ' || NEW.supplier_name, NEW.total_amount, 0);

  IF v_total_local_charges > 0 AND v_customs_account_id IS NOT NULL THEN
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
    VALUES (v_journal_entry_id, v_customs_account_id, 'Customs/Local charges - ' || NEW.purchase_number, 0, v_total_local_charges);
  END IF;

  IF TG_OP = 'INSERT' AND NEW.payment_status = 'paid' THEN
    IF NEW.payment_method IN ('mobile_money', 'card', 'bank_transfer') THEN
      v_payment_account_id := COALESCE(v_mobile_money_account_id, v_payable_account_id);
    ELSE
      v_payment_account_id := COALESCE(v_cash_account_id, v_payable_account_id);
    END IF;

    INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
    VALUES (v_journal_entry_id, v_payment_account_id, 'Paiement - ' || NEW.payment_method, 0, v_cif_amount);
  ELSE
    v_payment_account_id := COALESCE(v_supplier_ledger_id, v_payable_account_id);

    INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
    VALUES (v_journal_entry_id, v_payment_account_id, 'Fournisseur - ' || NEW.supplier_name, 0, v_cif_amount);
  END IF;

  RETURN NEW;
END;
$function$;

UPDATE public.journal_entries je
SET entry_date = pt.created_at::date
FROM public.pos_transactions pt
WHERE je.reference = pt.transaction_number
  AND je.entry_date IS DISTINCT FROM pt.created_at::date;

UPDATE public.journal_entries je
SET entry_date = p.purchased_at::date
FROM public.purchases p
WHERE je.reference = p.purchase_number
  AND je.description LIKE 'Achat - %'
  AND je.entry_date IS DISTINCT FROM p.purchased_at::date;