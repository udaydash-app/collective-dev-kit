-- Add payment_details column to purchases table to support multiple payment methods
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS payment_details jsonb DEFAULT '[]'::jsonb;

-- Add comment explaining the structure
COMMENT ON COLUMN purchases.payment_details IS 'Array of payment objects: [{"method": "cash", "amount": 100}, {"method": "card", "amount": 50}]';

-- Update existing purchases to have payment_details based on current payment_method
UPDATE purchases
SET payment_details = jsonb_build_array(
  jsonb_build_object(
    'method', COALESCE(payment_method, 'cash'),
    'amount', total_amount
  )
)
WHERE payment_details = '[]'::jsonb AND payment_method IS NOT NULL;

-- Add index for better query performance on payment status
CREATE INDEX IF NOT EXISTS idx_purchases_payment_status ON purchases(payment_status);
CREATE INDEX IF NOT EXISTS idx_purchases_store_date ON purchases(store_id, purchased_at);