-- Delete old-format customer codes with 0 balance (duplicates)
DELETE FROM accounts WHERE account_code LIKE '411-%' AND current_balance = 0;

-- Delete the old 4110 Product Sales since 701 already exists
DELETE FROM accounts WHERE account_code = '4110' AND account_name = 'Product Sales' AND current_balance = 0;

-- Fix account types for owner drawings
UPDATE accounts SET account_type = 'equity' WHERE account_code LIKE '109%';