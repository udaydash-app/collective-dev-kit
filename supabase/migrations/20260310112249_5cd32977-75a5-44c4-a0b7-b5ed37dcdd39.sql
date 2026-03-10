
-- Add index on pos_transactions created_at for faster ordering/filtering
CREATE INDEX IF NOT EXISTS idx_pos_transactions_created_at 
ON public.pos_transactions (created_at DESC);

-- Add index on orders created_at for faster ordering/filtering
CREATE INDEX IF NOT EXISTS idx_orders_created_at 
ON public.orders (created_at DESC);

-- Add index on orders updated_at for the OR filter used in the query
CREATE INDEX IF NOT EXISTS idx_orders_updated_at 
ON public.orders (updated_at DESC);
