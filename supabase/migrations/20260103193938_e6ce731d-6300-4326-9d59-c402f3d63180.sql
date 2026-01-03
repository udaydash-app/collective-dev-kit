-- Create trigger function to generate journal entries for daily expenses
CREATE OR REPLACE FUNCTION public.create_expense_journal_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_journal_entry_id UUID;
  v_expense_account_id UUID;
  v_payment_account_id UUID;
  v_cash_account_id UUID;
  v_mobile_money_account_id UUID;
BEGIN
  -- Handle DELETE - remove the associated journal entry
  IF TG_OP = 'DELETE' THEN
    DELETE FROM journal_entries 
    WHERE reference = 'EXP-' || OLD.id::text;
    RETURN OLD;
  END IF;

  -- Handle UPDATE - delete old journal entry first
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM journal_entries 
    WHERE reference = 'EXP-' || OLD.id::text;
  END IF;

  -- Get payment account IDs using SYSCOHADA codes
  SELECT id INTO v_cash_account_id FROM accounts WHERE account_code = '571' AND is_active = true LIMIT 1;
  SELECT id INTO v_mobile_money_account_id FROM accounts WHERE account_code = '521' AND is_active = true LIMIT 1;
  
  -- Determine expense account based on category (use generic expense account 6)
  -- Try to find a matching expense account by category name, or use default
  SELECT id INTO v_expense_account_id FROM accounts 
  WHERE account_type = 'expense' 
    AND is_active = true 
    AND (
      account_name ILIKE '%' || NEW.category || '%'
      OR account_code LIKE '6%'
    )
  ORDER BY 
    CASE WHEN account_name ILIKE '%' || NEW.category || '%' THEN 0 ELSE 1 END,
    account_code
  LIMIT 1;
  
  -- Fallback to any expense account if none found
  IF v_expense_account_id IS NULL THEN
    SELECT id INTO v_expense_account_id FROM accounts 
    WHERE account_type = 'expense' AND is_active = true 
    ORDER BY account_code 
    LIMIT 1;
  END IF;
  
  -- If still no expense account, skip journal entry
  IF v_expense_account_id IS NULL THEN
    RAISE WARNING 'No expense account found, skipping journal entry for expense %', NEW.id;
    RETURN NEW;
  END IF;

  -- Determine payment account based on payment method
  CASE NEW.payment_method
    WHEN 'cash' THEN v_payment_account_id := v_cash_account_id;
    WHEN 'mobile_money' THEN v_payment_account_id := v_mobile_money_account_id;
    WHEN 'card' THEN v_payment_account_id := v_mobile_money_account_id; -- Card uses bank account
    ELSE v_payment_account_id := v_cash_account_id;
  END CASE;

  IF v_payment_account_id IS NULL THEN
    RAISE WARNING 'No payment account found for method %, skipping journal entry', NEW.payment_method;
    RETURN NEW;
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
    created_by,
    posted_by,
    posted_at
  ) VALUES (
    'Dépense - ' || NEW.category || ': ' || NEW.description,
    NEW.expense_date::date,
    'EXP-' || NEW.id::text,
    NEW.amount,
    NEW.amount,
    NEW.amount,
    'posted',
    NEW.created_by,
    NEW.created_by,
    NOW()
  ) RETURNING id INTO v_journal_entry_id;

  -- Debit: Expense account (increase expense)
  INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
  VALUES (v_journal_entry_id, v_expense_account_id, NEW.category || ' - ' || NEW.description, NEW.amount, 0);

  -- Credit: Payment account (decrease cash or mobile money)
  INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
  VALUES (v_journal_entry_id, v_payment_account_id, 
    CASE NEW.payment_method 
      WHEN 'cash' THEN 'Paiement espèces'
      WHEN 'mobile_money' THEN 'Paiement Mobile Money'
      WHEN 'card' THEN 'Paiement carte'
      ELSE 'Paiement - ' || NEW.payment_method
    END, 
    0, NEW.amount);

  RETURN NEW;
END;
$function$;

-- Create trigger on expenses table
DROP TRIGGER IF EXISTS create_expense_journal ON expenses;
CREATE TRIGGER create_expense_journal
  AFTER INSERT OR UPDATE OR DELETE ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION create_expense_journal_entry();