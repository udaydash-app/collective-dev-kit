
-- Fix: The create_purchase_journal_entry trigger was re-creating the purchase journal entry
-- every time a purchase was updated (e.g. when payment_status/amount_paid changed after a supplier payment).
-- This caused duplicate journal entries: one from the purchase trigger + one from supplier payment trigger.
--
-- Solution: On UPDATE, skip recreating the purchase journal entry when only payment tracking
-- fields changed (amount_paid, payment_status, payment_details, payment_method).
-- These are handled exclusively by the supplier_payment trigger.

CREATE OR REPLACE FUNCTION public.create_purchase_journal_entry()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
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
    DELETE FROM journal_entries WHERE reference = OLD.purchase_number AND description LIKE 'Achat - %';
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- If only payment tracking fields changed (driven by supplier_payments trigger),
    -- do NOT recreate the purchase journal entry to avoid duplicates.
    -- Only recreate if substantive purchase fields changed.
    IF (
      OLD.total_amount IS NOT DISTINCT FROM NEW.total_amount AND
      OLD.supplier_name IS NOT DISTINCT FROM NEW.supplier_name AND
      OLD.purchase_number IS NOT DISTINCT FROM NEW.purchase_number
    ) THEN
      -- Only payment/status fields changed — skip journal recreation
      RETURN NEW;
    END IF;

    -- Substantive change: delete old entry and recreate
    DELETE FROM journal_entries WHERE reference = OLD.purchase_number AND description LIKE 'Achat - %';
  END IF;

  -- Get account IDs using SYSCOHADA codes
  SELECT id INTO v_inventory_account_id FROM accounts WHERE account_code = '31' LIMIT 1;
  SELECT id INTO v_cash_account_id FROM accounts WHERE account_code = '571' AND is_active = true LIMIT 1;
  SELECT id INTO v_mobile_money_account_id FROM accounts WHERE account_code = '521' LIMIT 1;
  SELECT id INTO v_payable_account_id FROM accounts WHERE account_code = '401' LIMIT 1;

  SELECT supplier_ledger_account_id INTO v_supplier_ledger_id 
  FROM contacts WHERE name = NEW.supplier_name AND is_supplier = true LIMIT 1;

  INSERT INTO journal_entries (description, entry_date, reference, total_debit, total_credit, status, created_by, posted_by, posted_at)
  VALUES ('Achat - ' || NEW.purchase_number, CURRENT_DATE, NEW.purchase_number, NEW.total_amount, NEW.total_amount, 'posted', NEW.purchased_by, NEW.purchased_by, NOW())
  RETURNING id INTO v_journal_entry_id;

  INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
  VALUES (v_journal_entry_id, v_inventory_account_id, 'Achat marchandises - ' || NEW.supplier_name, NEW.total_amount, 0);

  -- On INSERT: if already paid, use cash/bank account; otherwise use supplier payable
  -- On UPDATE (substantive): always use supplier payable as it was already a liability
  IF TG_OP = 'INSERT' AND NEW.payment_status = 'paid' THEN
    IF NEW.payment_method IN ('mobile_money', 'card', 'bank_transfer') THEN
      v_payment_account_id := COALESCE(v_mobile_money_account_id, v_payable_account_id);
    ELSE
      v_payment_account_id := COALESCE(v_cash_account_id, v_payable_account_id);
    END IF;

    INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
    VALUES (v_journal_entry_id, v_payment_account_id, 'Paiement - ' || NEW.payment_method, 0, NEW.total_amount);
  ELSE
    v_payment_account_id := COALESCE(v_supplier_ledger_id, v_payable_account_id);

    INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
    VALUES (v_journal_entry_id, v_payment_account_id, 'Fournisseur - ' || NEW.supplier_name, 0, NEW.total_amount);
  END IF;

  RETURN NEW;
END;
$function$;
