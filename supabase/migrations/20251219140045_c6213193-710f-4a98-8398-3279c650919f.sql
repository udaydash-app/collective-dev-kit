-- Update existing customer ledger accounts to use sequential SYSCOHADA codes (4111, 4112, ...)
-- Based on contact creation date ascending

WITH numbered_customers AS (
  SELECT 
    c.id as contact_id,
    c.customer_ledger_account_id,
    ROW_NUMBER() OVER (ORDER BY c.created_at ASC) as seq_num
  FROM contacts c
  WHERE c.is_customer = true 
    AND c.customer_ledger_account_id IS NOT NULL
)
UPDATE accounts a
SET account_code = '411' || nc.seq_num
FROM numbered_customers nc
WHERE a.id = nc.customer_ledger_account_id;

-- Also update supplier accounts to use sequential codes (4011, 4012, 4013...)
WITH numbered_suppliers AS (
  SELECT 
    c.id as contact_id,
    c.supplier_ledger_account_id,
    ROW_NUMBER() OVER (ORDER BY c.created_at ASC) as seq_num
  FROM contacts c
  WHERE c.is_supplier = true 
    AND c.supplier_ledger_account_id IS NOT NULL
)
UPDATE accounts a
SET account_code = '401' || ns.seq_num
FROM numbered_suppliers ns
WHERE a.id = ns.supplier_ledger_account_id;

-- Create a function to get the next customer account code
CREATE OR REPLACE FUNCTION public.get_next_customer_account_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  max_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(SUBSTRING(account_code FROM 4)::INTEGER), 0) INTO max_num
  FROM accounts
  WHERE account_code ~ '^411[0-9]+$';
  
  RETURN '411' || (max_num + 1);
END;
$$;

-- Create a function to get the next supplier account code
CREATE OR REPLACE FUNCTION public.get_next_supplier_account_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  max_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(SUBSTRING(account_code FROM 4)::INTEGER), 0) INTO max_num
  FROM accounts
  WHERE account_code ~ '^401[0-9]+$';
  
  RETURN '401' || (max_num + 1);
END;
$$;