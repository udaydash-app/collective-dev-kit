-- =============================================
-- SYSCOHADA Account Code Migration for Ivory Coast
-- =============================================

-- Step 1: Update existing account codes to SYSCOHADA standards
UPDATE accounts SET account_code = '571', account_name = 'Caisse' WHERE account_code IN ('1010', '1110');
UPDATE accounts SET account_code = '521', account_name = 'Banque Mobile Money' WHERE account_code = '1015';
UPDATE accounts SET account_code = '31', account_name = 'Stocks de marchandises' WHERE account_code = '1020';
UPDATE accounts SET account_code = '411', account_name = 'Clients' WHERE account_code = '1030';
UPDATE accounts SET account_code = '401', account_name = 'Fournisseurs' WHERE account_code = '2010';
UPDATE accounts SET account_code = '4431', account_name = 'TVA collectée' WHERE account_code = '2020';
UPDATE accounts SET account_code = '4471', account_name = 'État - Droits de timbre' WHERE account_code = '2025';
UPDATE accounts SET account_code = '101', account_name = 'Capital' WHERE account_code = '3010';
UPDATE accounts SET account_code = '701', account_name = 'Ventes de marchandises' WHERE account_code = '4010';
UPDATE accounts SET account_code = '709', account_name = 'Rabais, remises accordés' WHERE account_code = '4020';
UPDATE accounts SET account_code = '603', account_name = 'Variation des stocks (COGS)' WHERE account_code = '5010';
UPDATE accounts SET account_code = '61', account_name = 'Services extérieurs' WHERE account_code = '5020';

-- Update any customer/supplier ledger accounts that have old prefixes
UPDATE accounts SET account_code = REPLACE(account_code, '1030-', '411-') WHERE account_code LIKE '1030-%';
UPDATE accounts SET account_code = REPLACE(account_code, '2010-', '401-') WHERE account_code LIKE '2010-%';

-- Step 2: Update handle_pos_journal_entry function with SYSCOHADA codes
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
  v_timbre_account_id UUID;
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
  v_abs_timbre_tax NUMERIC := 0;
  v_total_debit NUMERIC;
  v_total_credit NUMERIC;
BEGIN
  -- Handle DELETE
  IF TG_OP = 'DELETE' THEN
    DELETE FROM journal_entries 
    WHERE reference = OLD.transaction_number;
    RETURN OLD;
  END IF;

  -- Handle UPDATE - delete old entries first
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM journal_entries 
    WHERE reference = OLD.transaction_number;
  END IF;

  -- Check if this is a refund transaction
  v_is_refund := (NEW.metadata IS NOT NULL AND (NEW.metadata->>'is_refund')::boolean = true) OR NEW.total < 0;

  -- Use absolute values for calculations
  v_abs_total := ABS(NEW.total);
  v_abs_subtotal := ABS(NEW.subtotal);
  v_abs_discount := ABS(NEW.discount);
  v_abs_tax := ABS(NEW.tax);
  
  -- Extract Timbre tax from metadata if present
  IF NEW.metadata IS NOT NULL AND NEW.metadata ? 'timbreTax' THEN
    v_abs_timbre_tax := ABS(COALESCE((NEW.metadata->>'timbreTax')::NUMERIC, 0));
  END IF;

  -- Check if journal entry already exists
  SELECT COUNT(*) INTO v_existing_entry_count
  FROM journal_entries
  WHERE reference = NEW.transaction_number;

  IF v_existing_entry_count > 0 THEN
    RETURN NEW;
  END IF;

  -- Get account IDs using SYSCOHADA codes
  SELECT id INTO v_cash_account_id FROM accounts WHERE account_code = '571' AND is_active = true LIMIT 1;
  SELECT id INTO v_mobile_money_account_id FROM accounts WHERE account_code = '521' LIMIT 1;
  SELECT id INTO v_sales_account_id FROM accounts WHERE account_code = '701' LIMIT 1;
  SELECT id INTO v_discount_account_id FROM accounts WHERE account_code = '709' LIMIT 1;
  SELECT id INTO v_tax_account_id FROM accounts WHERE account_code = '4431' LIMIT 1;
  SELECT id INTO v_timbre_account_id FROM accounts WHERE account_code = '4471' LIMIT 1;
  SELECT id INTO v_ar_account_id FROM accounts WHERE account_code = '411' LIMIT 1;
  SELECT id INTO v_cogs_account_id FROM accounts WHERE account_code = '603' LIMIT 1;
  SELECT id INTO v_inventory_account_id FROM accounts WHERE account_code = '31' LIMIT 1;

  -- Get customer ledger account if customer_id is set
  IF NEW.customer_id IS NOT NULL THEN
    SELECT customer_ledger_account_id INTO v_customer_ledger_id 
    FROM contacts 
    WHERE id = NEW.customer_id;
  END IF;

  -- Calculate total for journal entry (excluding timbre from regular tax)
  v_total_debit := v_abs_total;
  v_total_credit := v_abs_total;

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
    CASE WHEN v_is_refund THEN 'Remboursement POS - ' ELSE 'Vente POS - ' END || NEW.transaction_number,
    CURRENT_DATE,
    NEW.transaction_number,
    v_total_debit,
    v_total_credit,
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

  IF v_is_refund THEN
    -- REFUND: Reverse entries
    -- Credit: Cash/Payment account
    IF v_payment_account_id IS NOT NULL AND v_abs_total > 0 THEN
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
      VALUES (v_journal_entry_id, v_payment_account_id, 'Remboursement client', 0, v_abs_total);
    END IF;

    -- Debit: Sales revenue
    IF v_abs_subtotal > 0 THEN
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
      VALUES (v_journal_entry_id, v_sales_account_id, 'Annulation vente', v_abs_subtotal + v_abs_discount, 0);
    END IF;

    -- Credit: Discount (if any)
    IF v_abs_discount > 0 AND v_discount_account_id IS NOT NULL THEN
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
      VALUES (v_journal_entry_id, v_discount_account_id, 'Annulation remise', 0, v_abs_discount);
    END IF;

    -- Debit: Tax (if any)
    IF v_abs_tax > 0 AND v_tax_account_id IS NOT NULL THEN
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
      VALUES (v_journal_entry_id, v_tax_account_id, 'Annulation TVA', v_abs_tax, 0);
    END IF;

    -- Debit: Timbre tax (if any)
    IF v_abs_timbre_tax > 0 AND v_timbre_account_id IS NOT NULL THEN
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
      VALUES (v_journal_entry_id, v_timbre_account_id, 'Annulation droit de timbre', v_abs_timbre_tax, 0);
    END IF;
  ELSE
    -- SALE: Normal entries
    -- Debit: Cash/Payment account
    IF v_payment_account_id IS NOT NULL AND v_abs_total > 0 THEN
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
      VALUES (v_journal_entry_id, v_payment_account_id, 
        CASE NEW.payment_method 
          WHEN 'credit' THEN 'Vente à crédit'
          WHEN 'mobile_money' THEN 'Paiement Mobile Money'
          ELSE 'Paiement espèces'
        END, v_abs_total, 0);
    END IF;

    -- Credit: Sales revenue (gross amount before discount)
    IF v_abs_subtotal > 0 THEN
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
      VALUES (v_journal_entry_id, v_sales_account_id, 'Ventes de marchandises', 0, v_abs_subtotal + v_abs_discount);
    END IF;

    -- Debit: Discount given (if any)
    IF v_abs_discount > 0 AND v_discount_account_id IS NOT NULL THEN
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
      VALUES (v_journal_entry_id, v_discount_account_id, 'Remise accordée', v_abs_discount, 0);
    END IF;

    -- Credit: Sales tax (if any) - excluding timbre
    IF (v_abs_tax - v_abs_timbre_tax) > 0 AND v_tax_account_id IS NOT NULL THEN
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
      VALUES (v_journal_entry_id, v_tax_account_id, 'TVA collectée', 0, v_abs_tax - v_abs_timbre_tax);
    END IF;

    -- Credit: Timbre tax separately (if any)
    IF v_abs_timbre_tax > 0 AND v_timbre_account_id IS NOT NULL THEN
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
      VALUES (v_journal_entry_id, v_timbre_account_id, 'Droit de timbre', 0, v_abs_timbre_tax);
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Step 3: Update create_purchase_journal_entry function with SYSCOHADA codes
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
    DELETE FROM journal_entries WHERE reference = OLD.purchase_number AND description LIKE 'Achat - %';
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    DELETE FROM journal_entries WHERE reference = OLD.purchase_number AND description LIKE 'Achat - %';
  END IF;

  -- Get account IDs using SYSCOHADA codes
  SELECT id INTO v_inventory_account_id FROM accounts WHERE account_code = '31' LIMIT 1;
  SELECT id INTO v_cash_account_id FROM accounts WHERE account_code = '571' AND is_active = true LIMIT 1;
  SELECT id INTO v_mobile_money_account_id FROM accounts WHERE account_code = '521' LIMIT 1;
  SELECT id INTO v_payable_account_id FROM accounts WHERE account_code = '401' LIMIT 1;

  SELECT supplier_ledger_account_id INTO v_supplier_ledger_id FROM contacts WHERE name = NEW.supplier_name AND is_supplier = true LIMIT 1;

  INSERT INTO journal_entries (description, entry_date, reference, total_debit, total_credit, status, created_by, posted_by, posted_at)
  VALUES ('Achat - ' || NEW.purchase_number, CURRENT_DATE, NEW.purchase_number, NEW.total_amount, NEW.total_amount, 'posted', NEW.purchased_by, NEW.purchased_by, NOW())
  RETURNING id INTO v_journal_entry_id;

  INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
  VALUES (v_journal_entry_id, v_inventory_account_id, 'Achat marchandises - ' || NEW.supplier_name, NEW.total_amount, 0);

  IF NEW.payment_status = 'paid' THEN
    IF NEW.payment_method = 'mobile_money' THEN v_payment_account_id := v_mobile_money_account_id;
    ELSE v_payment_account_id := v_cash_account_id; END IF;
  ELSE v_payment_account_id := COALESCE(v_supplier_ledger_id, v_payable_account_id); END IF;

  INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
  VALUES (v_journal_entry_id, v_payment_account_id, CASE WHEN NEW.payment_status = 'paid' THEN 'Paiement - ' || NEW.payment_method ELSE 'Fournisseur - ' || NEW.supplier_name END, 0, NEW.total_amount);

  RETURN NEW;
END;
$function$;

-- Step 4: Update create_supplier_payment_journal_entry function with SYSCOHADA codes
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
    UPDATE journal_entries SET entry_date = NEW.payment_date, description = 'Paiement fournisseur - ' || NEW.payment_number, total_debit = NEW.amount, total_credit = NEW.amount, updated_at = now()
    WHERE reference = OLD.payment_number RETURNING id INTO v_je_id;

    IF v_je_id IS NOT NULL THEN
      SELECT supplier_ledger_account_id INTO v_supplier_account_id FROM contacts WHERE id = NEW.contact_id;
      
      SELECT id INTO v_payment_account_id FROM accounts 
      WHERE account_name = CASE NEW.payment_method WHEN 'cash' THEN 'Caisse' WHEN 'card' THEN 'Banque' WHEN 'mobile_money' THEN 'Banque Mobile Money' ELSE 'Caisse' END 
      LIMIT 1;

      DELETE FROM journal_entry_lines WHERE journal_entry_id = v_je_id;
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description) VALUES (v_je_id, v_supplier_account_id, NEW.amount, 0, 'Paiement fournisseur');
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description) VALUES (v_je_id, v_payment_account_id, 0, NEW.amount, 'Mode de paiement: ' || NEW.payment_method);
    END IF;
    RETURN NEW;
  END IF;

  SELECT supplier_ledger_account_id INTO v_supplier_account_id FROM contacts WHERE id = NEW.contact_id;
  IF v_supplier_account_id IS NULL THEN RAISE EXCEPTION 'Compte fournisseur non trouvé pour le contact %', NEW.contact_id; END IF;

  SELECT id INTO v_payment_account_id FROM accounts 
  WHERE account_name = CASE NEW.payment_method WHEN 'cash' THEN 'Caisse' WHEN 'card' THEN 'Banque' WHEN 'mobile_money' THEN 'Banque Mobile Money' ELSE 'Caisse' END 
  LIMIT 1;

  INSERT INTO journal_entries (entry_date, description, reference, total_debit, total_credit, status, posted_at, posted_by, created_by)
  VALUES (NEW.payment_date, 'Paiement fournisseur - ' || NEW.payment_number, NEW.payment_number, NEW.amount, NEW.amount, 'posted', now(), NEW.paid_by, NEW.paid_by)
  RETURNING id INTO v_je_id;

  INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description) VALUES (v_je_id, v_supplier_account_id, NEW.amount, 0, 'Paiement fournisseur');
  INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description) VALUES (v_je_id, v_payment_account_id, 0, NEW.amount, 'Mode de paiement: ' || NEW.payment_method);

  RETURN NEW;
END;
$function$;

-- Step 5: Update create_payment_receipt_journal_entry function with SYSCOHADA codes
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
    UPDATE journal_entries SET entry_date = NEW.payment_date, description = 'Encaissement client - ' || NEW.receipt_number, total_debit = NEW.amount, total_credit = NEW.amount, updated_at = now()
    WHERE reference = OLD.receipt_number RETURNING id INTO v_je_id;

    IF v_je_id IS NOT NULL THEN
      SELECT customer_ledger_account_id INTO v_customer_account_id FROM contacts WHERE id = NEW.contact_id;
      
      SELECT id INTO v_payment_account_id FROM accounts 
      WHERE account_name = CASE NEW.payment_method WHEN 'cash' THEN 'Caisse' WHEN 'card' THEN 'Banque' WHEN 'mobile_money' THEN 'Banque Mobile Money' ELSE 'Caisse' END 
      LIMIT 1;

      DELETE FROM journal_entry_lines WHERE journal_entry_id = v_je_id;
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description) VALUES (v_je_id, v_payment_account_id, NEW.amount, 0, 'Mode de paiement: ' || NEW.payment_method);
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description) VALUES (v_je_id, v_customer_account_id, 0, NEW.amount, 'Encaissement client');
    END IF;
    RETURN NEW;
  END IF;

  SELECT customer_ledger_account_id INTO v_customer_account_id FROM contacts WHERE id = NEW.contact_id;
  IF v_customer_account_id IS NULL THEN RAISE EXCEPTION 'Compte client non trouvé pour le contact %', NEW.contact_id; END IF;

  SELECT id INTO v_payment_account_id FROM accounts 
  WHERE account_name = CASE NEW.payment_method WHEN 'cash' THEN 'Caisse' WHEN 'card' THEN 'Banque' WHEN 'mobile_money' THEN 'Banque Mobile Money' ELSE 'Caisse' END 
  LIMIT 1;

  INSERT INTO journal_entries (entry_date, description, reference, total_debit, total_credit, status, posted_at, posted_by, created_by)
  VALUES (NEW.payment_date, 'Encaissement client - ' || NEW.receipt_number, NEW.receipt_number, NEW.amount, NEW.amount, 'posted', now(), NEW.received_by, NEW.received_by)
  RETURNING id INTO v_je_id;

  INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description) VALUES (v_je_id, v_payment_account_id, NEW.amount, 0, 'Mode de paiement: ' || NEW.payment_method);
  INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description) VALUES (v_je_id, v_customer_account_id, 0, NEW.amount, 'Encaissement client');

  RETURN NEW;
END;
$function$;

-- Step 6: Update handle_online_order_journal_entry function with SYSCOHADA codes
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
    
    -- Delete existing journal entry if it exists
    DELETE FROM journal_entries WHERE reference = NEW.order_number;

    -- Get account IDs using SYSCOHADA codes
    SELECT id INTO v_cash_account_id FROM accounts WHERE account_code = '571' AND is_active = true LIMIT 1;
    SELECT id INTO v_mobile_money_account_id FROM accounts WHERE account_code = '521' LIMIT 1;
    SELECT id INTO v_sales_account_id FROM accounts WHERE account_code = '701' LIMIT 1;
    SELECT id INTO v_tax_account_id FROM accounts WHERE account_code = '4431' LIMIT 1;
    SELECT id INTO v_ar_account_id FROM accounts WHERE account_code = '411' LIMIT 1;

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
      'Vente en ligne - ' || NEW.order_number,
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

    -- Debit: Payment account
    IF v_payment_account_id IS NOT NULL AND NEW.total > 0 THEN
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
      VALUES (v_journal_entry_id, v_payment_account_id,
        CASE WHEN NEW.payment_method = 'credit' THEN 'Vente à crédit' ELSE 'Paiement reçu - ' || COALESCE(NEW.payment_method, 'espèces') END,
        NEW.total, 0);
    END IF;

    -- Credit: Sales revenue
    IF NEW.subtotal > 0 THEN
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
      VALUES (v_journal_entry_id, v_sales_account_id, 'Ventes de marchandises', 0, NEW.subtotal);
    END IF;

    -- Credit: Tax (if any)
    IF NEW.tax > 0 THEN
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
      VALUES (v_journal_entry_id, v_tax_account_id, 'TVA collectée', 0, NEW.tax);
    END IF;

  END IF;

  RETURN NEW;
END;
$function$;

-- Step 7: Update create_cash_register_opening_entry function with SYSCOHADA codes
CREATE OR REPLACE FUNCTION public.create_cash_register_opening_entry()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cash_account_id UUID;
  v_owner_account_id UUID;
  v_journal_entry_id UUID;
BEGIN
  -- Only create entry if opening_cash > 0 and it's a new INSERT
  IF NEW.opening_cash > 0 AND TG_OP = 'INSERT' THEN
    -- Get account IDs using SYSCOHADA codes
    SELECT id INTO v_cash_account_id 
    FROM accounts 
    WHERE account_code = '571' 
      AND is_active = true 
    LIMIT 1;
    
    IF v_cash_account_id IS NULL THEN
      RAISE WARNING 'Compte Caisse (571) non trouvé, écriture ignorée';
      RETURN NEW;
    END IF;
    
    SELECT id INTO v_owner_account_id 
    FROM accounts 
    WHERE account_code LIKE '401-%' 
    LIMIT 1;
    
    -- Create journal entry
    INSERT INTO journal_entries (
      description,
      entry_date,
      reference,
      total_debit,
      total_credit,
      status,
      created_by,
      posted_by,
      posted_at
    ) VALUES (
      'Ouverture caisse - Session ' || NEW.id,
      DATE(NEW.opened_at),
      'CAISSE-' || UPPER(SUBSTRING(REPLACE(NEW.id::text, '-', '') FROM 1 FOR 10)),
      NEW.opening_cash,
      NEW.opening_cash,
      'posted',
      NEW.cashier_id,
      NEW.cashier_id,
      NEW.opened_at
    ) RETURNING id INTO v_journal_entry_id;
    
    -- Debit: Caisse
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
    VALUES (v_journal_entry_id, v_cash_account_id, 'Fonds de caisse reçu', NEW.opening_cash, 0);
    
    -- Credit: Owner account or Capital
    IF v_owner_account_id IS NOT NULL THEN
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
      VALUES (v_journal_entry_id, v_owner_account_id, 'Retrait pour caisse', 0, NEW.opening_cash);
    ELSE
      SELECT id INTO v_owner_account_id FROM accounts WHERE account_code = '101' LIMIT 1;
      IF v_owner_account_id IS NOT NULL THEN
        INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
        VALUES (v_journal_entry_id, v_owner_account_id, 'Retrait pour caisse', 0, NEW.opening_cash);
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;