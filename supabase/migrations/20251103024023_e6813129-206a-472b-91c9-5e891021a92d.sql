-- Clear all transactional data

-- Delete all cash sessions
DELETE FROM cash_sessions;

-- Delete all expenses  
DELETE FROM expenses;

-- Delete all journal entry lines (must delete before journal entries due to foreign key)
DELETE FROM journal_entry_lines;

-- Delete all journal entries
DELETE FROM journal_entries;

-- Delete all POS transactions
DELETE FROM pos_transactions;

-- Delete all payment receipts
DELETE FROM payment_receipts;

-- Delete purchase items first (foreign key dependency)
DELETE FROM purchase_items;

-- Delete all purchases
DELETE FROM purchases;

-- Reset all account balances to 0
UPDATE accounts SET current_balance = 0;