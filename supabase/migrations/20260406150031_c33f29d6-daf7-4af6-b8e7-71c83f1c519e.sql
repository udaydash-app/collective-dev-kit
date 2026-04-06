
-- Create the trigger on purchases table (was missing)
CREATE OR REPLACE TRIGGER trigger_purchase_journal_entry
  AFTER INSERT OR UPDATE OR DELETE ON purchases
  FOR EACH ROW
  EXECUTE FUNCTION public.create_purchase_journal_entry();

-- Also update the function to always re-create on UPDATE (removing the skip condition
-- that prevented re-creation when only items changed)
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
    -- Always re-create journal entry on update to capture item changes (local charges etc.)
    DELETE FROM journal_entries WHERE reference = OLD.purchase_number AND description LIKE 'Achat - %';
  END IF;

  -- Get account IDs
  SELECT id INTO v_inventory_account_id FROM accounts WHERE account_code = '31' LIMIT 1;
  SELECT id INTO v_cash_account_id FROM accounts WHERE account_code = '571' AND is_active = true LIMIT 1;
  SELECT id INTO v_mobile_money_account_id FROM accounts WHERE account_code = '521' LIMIT 1;
  SELECT id INTO v_payable_account_id FROM accounts WHERE account_code = '401' LIMIT 1;
  SELECT id INTO v_customs_account_id FROM accounts WHERE account_code = '6584' LIMIT 1;

  SELECT supplier_ledger_account_id INTO v_supplier_ledger_id 
  FROM contacts WHERE name = NEW.supplier_name AND is_supplier = true LIMIT 1;

  -- Calculate total local charges from purchase items
  SELECT COALESCE(SUM(COALESCE(local_charges, 0) * quantity), 0)
  INTO v_total_local_charges
  FROM purchase_items WHERE purchase_id = NEW.id;

  v_cif_amount := NEW.total_amount - v_total_local_charges;

  -- Create journal entry
  INSERT INTO journal_entries (description, entry_date, reference, total_debit, total_credit, status, created_by, posted_by, posted_at)
  VALUES ('Achat - ' || NEW.purchase_number, CURRENT_DATE, NEW.purchase_number, NEW.total_amount, NEW.total_amount, 'posted', NEW.purchased_by, NEW.purchased_by, NOW())
  RETURNING id INTO v_journal_entry_id;

  -- Debit Inventory for full amount
  INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
  VALUES (v_journal_entry_id, v_inventory_account_id, 'Achat marchandises - ' || NEW.supplier_name, NEW.total_amount, 0);

  -- Credit Customs Clearance for local charges (if any)
  IF v_total_local_charges > 0 AND v_customs_account_id IS NOT NULL THEN
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
    VALUES (v_journal_entry_id, v_customs_account_id, 'Customs/Local charges - ' || NEW.purchase_number, 0, v_total_local_charges);
  END IF;

  -- Credit supplier/payment for CIF amount
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
