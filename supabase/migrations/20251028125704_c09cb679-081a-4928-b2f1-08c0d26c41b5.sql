-- Clear all sales data to start fresh

-- Delete order items first (foreign key dependency)
DELETE FROM order_items;

-- Delete all orders
DELETE FROM orders;

-- Delete all POS transactions
DELETE FROM pos_transactions;

-- Reset sequences if any exist
-- This ensures new records start from fresh IDs