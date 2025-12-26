-- Update main system accounts to English names while keeping SYSCOHADA codes
UPDATE accounts SET account_name = 'Capital And Reserves' WHERE account_code = '10';
UPDATE accounts SET account_name = 'Share Capital' WHERE account_code = '101';
UPDATE accounts SET account_name = 'Owner''s Drawings' WHERE account_code = '109';
UPDATE accounts SET account_name = 'Retained Earnings' WHERE account_code = '12';
UPDATE accounts SET account_name = 'Loans and Similar Debts' WHERE account_code = '16';
UPDATE accounts SET account_name = 'Bank Loans' WHERE account_code = '162';
UPDATE accounts SET account_name = 'Liabilities' WHERE account_code = '19';
UPDATE accounts SET account_name = 'Fixed Assets' WHERE account_code = '2';
UPDATE accounts SET account_name = 'Tangible Fixed Assets' WHERE account_code = '20';
UPDATE accounts SET account_name = 'Equipment' WHERE account_code = '241';
UPDATE accounts SET account_name = 'Office Furniture' WHERE account_code = '2435';
UPDATE accounts SET account_name = 'Vehicles' WHERE account_code = '244';
UPDATE accounts SET account_name = 'Inventory' WHERE account_code = '31';
UPDATE accounts SET account_name = 'Suppliers and Related Accounts' WHERE account_code = '40';
UPDATE accounts SET account_name = 'Suppliers' WHERE account_code = '401';
UPDATE accounts SET account_name = 'Suppliers - Invoices Not Received' WHERE account_code = '408';
UPDATE accounts SET account_name = 'Customers' WHERE account_code = '411';
UPDATE accounts SET account_name = 'VAT Collected' WHERE account_code = '4431';
UPDATE accounts SET account_name = 'Stamp Tax' WHERE account_code = '4471';
UPDATE accounts SET account_name = 'Prepaid Expenses' WHERE account_code = '476';
UPDATE accounts SET account_name = 'Banks / Mobile Money' WHERE account_code = '521';
UPDATE accounts SET account_name = 'Cash' WHERE account_code = '571';
UPDATE accounts SET account_name = 'Purchases and Stock Changes' WHERE account_code = '60';
UPDATE accounts SET account_name = 'Cost of Goods Sold' WHERE account_code = '603';
UPDATE accounts SET account_name = 'External Services' WHERE account_code = '62';
UPDATE accounts SET account_name = 'Sales' WHERE account_code = '70';
UPDATE accounts SET account_name = 'Sales Revenue' WHERE account_code = '701';
UPDATE accounts SET account_name = 'Service Revenue' WHERE account_code = '706';

-- Update any additional expense accounts
UPDATE accounts SET account_name = 'Rent Expense' WHERE account_code = '6132';
UPDATE accounts SET account_name = 'Insurance Expense' WHERE account_code = '616';
UPDATE accounts SET account_name = 'Marketing Expense' WHERE account_code = '627';
UPDATE accounts SET account_name = 'Salaries Expense' WHERE account_code = '641';
UPDATE accounts SET account_name = 'Bank Charges' WHERE account_code = '631';
UPDATE accounts SET account_name = 'Depreciation Expense' WHERE account_code = '681';