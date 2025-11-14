
-- Create a function to get top credit customers with their balances
CREATE OR REPLACE FUNCTION get_top_credit_customers(limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
  id UUID,
  name TEXT,
  phone TEXT,
  email TEXT,
  balance DECIMAL,
  customer_balance DECIMAL,
  supplier_balance DECIMAL
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
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
    COALESCE(sa.current_balance, 0) as supplier_balance
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

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_top_credit_customers TO authenticated;
GRANT EXECUTE ON FUNCTION get_top_credit_customers TO anon;
