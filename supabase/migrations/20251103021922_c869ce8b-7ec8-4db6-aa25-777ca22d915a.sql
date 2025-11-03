-- Ensure Mobile Money account exists in Chart of Accounts
INSERT INTO accounts (
  account_code,
  account_name,
  account_type,
  parent_account_id,
  description,
  is_active,
  current_balance
)
SELECT 
  '1015',
  'Mobile Money',
  'asset',
  (SELECT id FROM accounts WHERE account_code = '1010' LIMIT 1),
  'Mobile Money accounts for customer and supplier transactions',
  true,
  0
WHERE NOT EXISTS (
  SELECT 1 FROM accounts WHERE account_code = '1015'
);