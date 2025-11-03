-- Insert required accounting accounts for purchase functionality
INSERT INTO accounts (account_code, account_name, account_type, description, is_active)
VALUES 
  ('1010', 'Cash', 'asset', 'Cash on hand and in bank', true),
  ('1015', 'Mobile Money', 'asset', 'Mobile money accounts', true),
  ('1020', 'Inventory', 'asset', 'Merchandise inventory', true),
  ('2010', 'Accounts Payable', 'liability', 'Amounts owed to suppliers', true),
  ('4010', 'Sales Revenue', 'revenue', 'Revenue from sales', true),
  ('2020', 'Sales Tax Payable', 'liability', 'Sales tax collected', true),
  ('1030', 'Accounts Receivable', 'asset', 'Amounts owed by customers', true),
  ('1011', 'Bank Account', 'asset', 'Bank account balance', true)
ON CONFLICT (account_code) DO NOTHING;