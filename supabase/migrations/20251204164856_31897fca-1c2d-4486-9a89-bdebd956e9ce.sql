-- Create function to update is_available_online based on stock quantity
CREATE OR REPLACE FUNCTION public.update_online_availability_by_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Update is_available_online based on stock_quantity
  IF NEW.stock_quantity IS NOT NULL THEN
    IF NEW.stock_quantity <= 0 THEN
      NEW.is_available_online := false;
    ELSIF NEW.stock_quantity > 0 AND (OLD.stock_quantity IS NULL OR OLD.stock_quantity <= 0) THEN
      -- Only set to true if it was previously out of stock
      NEW.is_available_online := true;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for products table
DROP TRIGGER IF EXISTS update_product_online_availability_trigger ON public.products;
CREATE TRIGGER update_product_online_availability_trigger
BEFORE UPDATE OF stock_quantity ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.update_online_availability_by_stock();