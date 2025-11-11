
-- Fix INDIAN BAZAAR supplier balance - should be 0 after full payment
UPDATE accounts 
SET current_balance = 0 
WHERE id = 'ecd3d153-43ac-4e35-b3f1-2db145a1d9aa';
