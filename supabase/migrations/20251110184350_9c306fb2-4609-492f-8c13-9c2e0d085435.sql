-- Manually link the obvious exact matches
-- BABA FOOD MART payment
UPDATE supplier_payments
SET purchase_id = (
  SELECT id FROM purchases 
  WHERE supplier_name = 'BABA FOOD MART' 
    AND total_amount = 20700 
    AND purchased_at::date = '2025-11-10'
  LIMIT 1
)
WHERE payment_number = 'SPM-2933C53536';

-- JW GLOBAL ENTERPRISES payment
UPDATE supplier_payments
SET purchase_id = (
  SELECT id FROM purchases 
  WHERE supplier_name = 'JW GLOBAL ENTERPRISES' 
    AND total_amount = 14000 
    AND purchased_at::date = '2025-11-08'
  LIMIT 1
)
WHERE payment_number = 'SPM-905C12A1AB';

-- FATIMA KOUMASSI payment
UPDATE supplier_payments
SET purchase_id = (
  SELECT id FROM purchases 
  WHERE supplier_name = 'FATIMA KOUMASSI' 
    AND total_amount = 133000 
    AND purchased_at::date = '2025-11-06'
  LIMIT 1
)
WHERE payment_number = 'SPM-065C1C909C';

-- Note: The triggers will automatically update the purchase payment_status, 
-- payment_method, amount_paid, and payment_details