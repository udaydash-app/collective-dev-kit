-- Create Sales Discount account
INSERT INTO accounts (
  account_code,
  account_name,
  account_type,
  description,
  is_active
) VALUES (
  '4020',
  'Sales Discounts',
  'revenue',
  'Contra-revenue account for sales discounts given',
  true
);

-- Update the POS journal entry trigger to use the discount account
CREATE OR REPLACE FUNCTION public.create_pos_journal_entry()
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
BEGIN
  -- Get account IDs
  SELECT id INTO v_cash_account_id FROM accounts WHERE account_code = '1010' LIMIT 1;
  SELECT id INTO v_mobile_money_account_id FROM accounts WHERE account_code = '1015' LIMIT 1;
  SELECT id INTO v_sales_account_id FROM accounts WHERE account_code = '4010' LIMIT 1;
  SELECT id INTO v_discount_account_id FROM accounts WHERE account_code = '4020' LIMIT 1;
  SELECT id INTO v_tax_account_id FROM accounts WHERE account_code = '2020' LIMIT 1;
  SELECT id INTO v_ar_account_id FROM accounts WHERE account_code = '1030' LIMIT 1;

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
    'POS Sale - ' || NEW.transaction_number,
    CURRENT_DATE,
    NEW.transaction_number,
    NEW.total,
    NEW.subtotal + NEW.tax,
    'posted',
    NEW.cashier_id,
    NEW.cashier_id,
    NOW()
  ) RETURNING id INTO v_journal_entry_id;

  -- Debit appropriate account based on payment method
  IF NEW.payment_method = 'credit' THEN
    -- For credit sales, check if there's a customer with ledger account
    IF NEW.customer_id IS NOT NULL THEN
      SELECT customer_ledger_account_id INTO v_customer_ledger_id
      FROM contacts
      WHERE id = NEW.customer_id;
      
      v_payment_account_id := COALESCE(v_customer_ledger_id, v_ar_account_id);
    ELSE
      v_payment_account_id := v_ar_account_id;
    END IF;
  ELSIF NEW.payment_method = 'mobile_money' THEN
    v_payment_account_id := v_mobile_money_account_id;
  ELSE
    v_payment_account_id := v_cash_account_id;
  END IF;

  -- Debit Cash/AR/Mobile Money
  INSERT INTO journal_entry_lines (
    journal_entry_id,
    account_id,
    description,
    debit_amount,
    credit_amount
  ) VALUES (
    v_journal_entry_id,
    v_payment_account_id,
    'POS Sale - ' || NEW.payment_method,
    NEW.total,
    0
  );

  -- Credit Sales Revenue
  INSERT INTO journal_entry_lines (
    journal_entry_id,
    account_id,
    description,
    debit_amount,
    credit_amount
  ) VALUES (
    v_journal_entry_id,
    v_sales_account_id,
    'Sales Revenue',
    0,
    NEW.subtotal
  );

  -- Credit Sales Tax if applicable
  IF NEW.tax > 0 THEN
    INSERT INTO journal_entry_lines (
      journal_entry_id,
      account_id,
      description,
      debit_amount,
      credit_amount
    ) VALUES (
      v_journal_entry_id,
      v_tax_account_id,
      'Sales Tax Collected',
      0,
      NEW.tax
    );
  END IF;

  -- Debit Sales Discount if any (reduces revenue)
  IF NEW.discount > 0 AND v_discount_account_id IS NOT NULL THEN
    INSERT INTO journal_entry_lines (
      journal_entry_id,
      account_id,
      description,
      debit_amount,
      credit_amount
    ) VALUES (
      v_journal_entry_id,
      v_discount_account_id,
      'Sales Discount',
      NEW.discount,
      0
    );
  END IF;

  RETURN NEW;
END;
$function$;