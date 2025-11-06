-- Drop duplicate triggers on purchase_items table
-- These duplicate triggers were causing stock to be added multiple times

DROP TRIGGER IF EXISTS update_stock_after_purchase_item ON public.purchase_items;
DROP TRIGGER IF EXISTS trigger_update_stock_on_purchase ON public.purchase_items;

-- Keep only one trigger with a clear name
DROP TRIGGER IF EXISTS update_stock_on_purchase_trigger ON public.purchase_items;

CREATE TRIGGER update_stock_on_purchase_trigger 
  AFTER INSERT ON public.purchase_items 
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_stock_on_purchase();