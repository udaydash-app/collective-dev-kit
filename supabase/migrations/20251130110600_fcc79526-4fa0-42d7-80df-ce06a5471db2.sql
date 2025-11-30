-- Update share_token generation to use URL-safe hex encoding instead of base64
ALTER TABLE purchase_orders 
ALTER COLUMN share_token 
SET DEFAULT encode(gen_random_bytes(32), 'hex');

-- Update existing purchase orders with URL-safe tokens
UPDATE purchase_orders 
SET share_token = encode(gen_random_bytes(32), 'hex')
WHERE share_token IS NOT NULL;