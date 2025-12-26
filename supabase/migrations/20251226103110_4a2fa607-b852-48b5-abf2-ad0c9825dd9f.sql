-- Drop and recreate the function to include ledger account IDs
DROP FUNCTION IF EXISTS get_top_credit_customers(integer);

CREATE OR REPLACE FUNCTION get_top_credit_customers(limit_count integer DEFAULT 10)
RETURNS TABLE (
  id uuid,
  name text,
  phone text,
  email text,
  balance numeric,
  customer_balance numeric,
  supplier_balance numeric,
  customer_ledger_account_id uuid,
  supplier_ledger_account_id uuid,
  is_customer boolean,
  is_supplier boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.name,
    c.phone,
    c.email,
    CASE 
      WHEN c.supplier_ledger_account_id IS NOT NULL THEN 
        COALESCE(ca.current_balance, 0) - COALESCE(sa.current_balance, 0)
      ELSE 
        COALESCE(ca.current_balance, 0)
    END as balance,
    COALESCE(ca.current_balance, 0) as customer_balance,
    COALESCE(sa.current_balance, 0) as supplier_balance,
    c.customer_ledger_account_id,
    c.supplier_ledger_account_id,
    c.is_customer,
    c.is_supplier
  FROM contacts c
  LEFT JOIN accounts ca ON ca.id = c.customer_ledger_account_id
  LEFT JOIN accounts sa ON sa.id = c.supplier_ledger_account_id
  WHERE c.is_customer = true
    AND c.customer_ledger_account_id IS NOT NULL
    AND COALESCE(ca.current_balance, 0) > 0
  ORDER BY balance DESC
  LIMIT limit_count;
END;
$$;