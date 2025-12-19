-- Update handle_purchase_payment_update function to use SYSCOHADA codes
CREATE OR REPLACE FUNCTION public.handle_purchase_payment_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cash_account_id uuid;
  v_payable_account_id uuid;
  v_journal_entry_id uuid;
BEGIN
  -- Only process if payment status changed from pending/partial to paid
  IF OLD.payment_status != 'paid' AND NEW.payment_status = 'paid' THEN
    -- Get account IDs using SYSCOHADA codes
    SELECT id INTO v_cash_account_id FROM accounts WHERE account_code = '571' AND is_active = true LIMIT 1;
    SELECT id INTO v_payable_account_id FROM accounts WHERE account_code = '401' LIMIT 1;

    -- Create journal entry for payment
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
      'Paiement achat - ' || NEW.purchase_number,
      CURRENT_DATE,
      NEW.purchase_number || '-PMT',
      NEW.total_amount,
      NEW.total_amount,
      'posted',
      auth.uid(),
      auth.uid(),
      NOW()
    ) RETURNING id INTO v_journal_entry_id;

    -- Debit Accounts Payable (Fournisseurs)
    INSERT INTO journal_entry_lines (
      journal_entry_id,
      account_id,
      description,
      debit_amount,
      credit_amount
    ) VALUES (
      v_journal_entry_id,
      v_payable_account_id,
      'Paiement à ' || NEW.supplier_name,
      NEW.total_amount,
      0
    );

    -- Credit Cash (Caisse)
    INSERT INTO journal_entry_lines (
      journal_entry_id,
      account_id,
      description,
      debit_amount,
      credit_amount
    ) VALUES (
      v_journal_entry_id,
      v_cash_account_id,
      'Paiement espèces - ' || NEW.payment_method,
      0,
      NEW.total_amount
    );
  END IF;

  RETURN NEW;
END;
$function$;