
-- Merge EMPTY contact into MUNI BABU BAFRIC
-- Reassign pos_transactions
UPDATE pos_transactions SET customer_id = '05350a98-0ac9-4c58-a32a-dded43f6d35e' WHERE customer_id = '903d4176-8fe0-4215-a80b-1485e9d313b0';

-- Reassign payment_receipts
UPDATE payment_receipts SET contact_id = '05350a98-0ac9-4c58-a32a-dded43f6d35e' WHERE contact_id = '903d4176-8fe0-4215-a80b-1485e9d313b0';

-- Reassign orders (just in case)
UPDATE orders SET customer_id = '05350a98-0ac9-4c58-a32a-dded43f6d35e' WHERE customer_id = '903d4176-8fe0-4215-a80b-1485e9d313b0';

-- Reassign supplier_payments (just in case)
UPDATE supplier_payments SET contact_id = '05350a98-0ac9-4c58-a32a-dded43f6d35e' WHERE contact_id = '903d4176-8fe0-4215-a80b-1485e9d313b0';

-- Reassign customer_product_prices (just in case)
UPDATE customer_product_prices SET customer_id = '05350a98-0ac9-4c58-a32a-dded43f6d35e' WHERE customer_id = '903d4176-8fe0-4215-a80b-1485e9d313b0';

-- Delete the EMPTY contact
DELETE FROM contacts WHERE id = '903d4176-8fe0-4215-a80b-1485e9d313b0';
