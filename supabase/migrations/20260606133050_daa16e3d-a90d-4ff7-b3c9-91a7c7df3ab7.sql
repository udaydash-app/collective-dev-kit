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
  v_journal_entry_id UUID;
  v_payment_account_id UUID;
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

    v_total := COALESCE(NEW.total, 0);
    v_subtotal := COALESCE(NEW.subtotal, 0);
    v_tax := COALESCE(NEW.tax, 0);
    v_discount := GREATEST(v_subtotal + v_tax - v_total, 0);
    v_delivery_fee := GREATEST(v_total - v_subtotal - v_tax, 0);

    INSERT INTO journal_entries (
      description, entry_date, reference, total_debit, total_credit,
      transaction_amount, status, posted_at
    ) VALUES (
      'Vente en ligne - ' || NEW.order_number,
      COALESCE(NEW.created_at, NOW())::date,
      NEW.order_number,
      v_total + v_discount,
      v_subtotal + v_tax + v_delivery_fee,
      v_total,
      'posted',
      NOW()
    ) RETURNING id INTO v_journal_entry_id;

    CASE NEW.payment_method
      WHEN 'cash' THEN v_payment_account_id := v_cash_account_id;
      WHEN 'mobile_money' THEN v_payment_account_id := v_mobile_money_account_id;
      WHEN 'card' THEN v_payment_account_id := v_cash_account_id;
      WHEN 'credit' THEN v_payment_account_id := COALESCE(v_customer_ledger_id, v_ar_account_id);
      ELSE v_payment_account_id := v_cash_account_id;
    END CASE;

    IF v_payment_account_id IS NOT NULL AND v_total > 0 THEN
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
      VALUES (v_journal_entry_id, v_payment_account_id,
        CASE WHEN NEW.payment_method = 'credit' THEN 'Vente à crédit' ELSE 'Paiement reçu - ' || COALESCE(NEW.payment_method, 'espèces') END,
        v_total, 0);
    END IF;

    IF v_discount > 0 AND v_discount_account_id IS NOT NULL THEN
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
      VALUES (v_journal_entry_id, v_discount_account_id, 'Remise commande en ligne', v_discount, 0);
    END IF;

    IF v_subtotal > 0 AND v_sales_account_id IS NOT NULL THEN
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
      VALUES (v_journal_entry_id, v_sales_account_id, 'Ventes de marchandises', 0, v_subtotal);
    END IF;

    IF v_tax > 0 AND v_tax_account_id IS NOT NULL THEN
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
      VALUES (v_journal_entry_id, v_tax_account_id, 'Timbre collecté', 0, v_tax);
    END IF;

    IF v_delivery_fee > 0 AND COALESCE(v_delivery_income_account_id, v_sales_account_id) IS NOT NULL THEN
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
      VALUES (v_journal_entry_id, COALESCE(v_delivery_income_account_id, v_sales_account_id), 'Delivery revenue', 0, v_delivery_fee);
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

WITH online_entries AS (
  SELECT je.id, COALESCE(SUM(l.debit_amount), 0) AS debit, COALESCE(SUM(l.credit_amount), 0) AS credit
  FROM public.journal_entries je
  LEFT JOIN public.journal_entry_lines l ON l.journal_entry_id = je.id
  WHERE je.description LIKE 'Vente en ligne - %'
  GROUP BY je.id
), accounts_for_fix AS (
  SELECT
    (SELECT id FROM public.accounts WHERE account_code = '709' LIMIT 1) AS discount_account_id,
    COALESCE((SELECT id FROM public.accounts WHERE account_code = '706' LIMIT 1), (SELECT id FROM public.accounts WHERE account_code = '701' LIMIT 1)) AS delivery_account_id
), inserted_discount AS (
  INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
  SELECT oe.id, aff.discount_account_id, 'Remise commande en ligne', oe.credit - oe.debit, 0
  FROM online_entries oe CROSS JOIN accounts_for_fix aff
  WHERE oe.credit > oe.debit AND aff.discount_account_id IS NOT NULL
  RETURNING journal_entry_id
), inserted_delivery AS (
  INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
  SELECT oe.id, aff.delivery_account_id, 'Delivery revenue', 0, oe.debit - oe.credit
  FROM online_entries oe CROSS JOIN accounts_for_fix aff
  WHERE oe.debit > oe.credit AND aff.delivery_account_id IS NOT NULL
  RETURNING journal_entry_id
)
SELECT 1;

WITH totals AS (
  SELECT journal_entry_id, SUM(debit_amount) AS debit, SUM(credit_amount) AS credit
  FROM public.journal_entry_lines
  GROUP BY journal_entry_id
)
UPDATE public.journal_entries je
SET total_debit = totals.debit,
    total_credit = totals.credit,
    transaction_amount = LEAST(totals.debit, totals.credit)
FROM totals
WHERE je.id = totals.journal_entry_id
  AND je.description LIKE 'Vente en ligne - %';

UPDATE public.journal_entries je
SET entry_date = o.created_at::date
FROM public.orders o
WHERE je.reference = o.order_number
  AND je.description LIKE 'Vente en ligne - %'
  AND je.entry_date IS DISTINCT FROM o.created_at::date;