-- Update payment_methods table to allow new payment types
-- First, drop the old check constraint
ALTER TABLE payment_methods DROP CONSTRAINT IF EXISTS payment_methods_type_check;

-- Add new check constraint with updated payment types
ALTER TABLE payment_methods 
ADD CONSTRAINT payment_methods_type_check 
CHECK (type IN ('store_credit', 'cash_on_delivery', 'wave_money', 'orange_money'));