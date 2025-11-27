-- Drop all FIFO-related database objects for better performance (corrected order)

-- Drop the batch FIFO function
DROP FUNCTION IF EXISTS public.deduct_stock_fifo_batch(jsonb);

-- Drop triggers and functions in correct order (triggers first)
DROP TRIGGER IF EXISTS create_inventory_layers_on_purchase ON public.purchases;
DROP FUNCTION IF EXISTS public.create_inventory_layers_on_purchase();

-- Drop reverse stock trigger and function (use CASCADE to handle dependencies)
DROP TRIGGER IF EXISTS reverse_stock_on_purchase_delete_trigger ON public.purchase_items;
DROP FUNCTION IF EXISTS public.reverse_stock_on_purchase_delete() CASCADE;

-- Comment that inventory_layers is now historical data only
COMMENT ON TABLE public.inventory_layers IS 'Historical table - no longer used for active FIFO tracking. Kept for historical purchase cost data only.';