-- Create trigger function to reverse stock on purchase item deletion
CREATE OR REPLACE FUNCTION public.reverse_stock_on_purchase_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Update product stock if no variant
  IF OLD.variant_id IS NULL THEN
    UPDATE products
    SET stock_quantity = GREATEST(0, stock_quantity - OLD.quantity),
        updated_at = NOW()
    WHERE id = OLD.product_id;
  ELSE
    -- Update variant stock
    UPDATE product_variants
    SET stock_quantity = GREATEST(0, stock_quantity - OLD.quantity),
        updated_at = NOW()
    WHERE id = OLD.variant_id;
  END IF;
  
  -- Delete the corresponding inventory layer
  DELETE FROM inventory_layers
  WHERE purchase_item_id = OLD.id;
  
  RETURN OLD;
END;
$function$;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS reverse_stock_on_purchase_item_delete ON purchase_items;

-- Create trigger for DELETE operations on purchase_items
CREATE TRIGGER reverse_stock_on_purchase_item_delete
  BEFORE DELETE ON purchase_items
  FOR EACH ROW
  EXECUTE FUNCTION reverse_stock_on_purchase_delete();