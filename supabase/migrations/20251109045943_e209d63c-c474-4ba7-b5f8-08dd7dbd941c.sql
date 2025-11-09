-- Fix INDIAN BAZAAR supplier balance to 0
-- Current supplier balance is 152,000 but should be 0

UPDATE accounts
SET current_balance = 0
WHERE id = 'ecd3d153-43ac-4e35-b3f1-2db145a1d9aa';