-- Fix purchase update inventory duplication
-- Problem: When updating a purchase, deleting old items doesn't deduct stock, but inserting new ones adds stock

-- 1. Drop the duplicate add_stock_from_purchase trigger on purchases table
-- (update_stock_on_purchase on purchase_items already handles stock addition)
DROP TRIGGER IF EXISTS trigger_add_stock_from_purchase ON purchases;

-- 2. Create a function to deduct stock when purchase_items are deleted
CREATE OR REPLACE FUNCTION public.deduct_stock_on_purchase_item_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Deduct stock when purchase item is deleted
  IF OLD.variant_id IS NOT NULL THEN
    -- Deduct from variant stock
    UPDATE product_variants
    SET stock_quantity = COALESCE(stock_quantity, 0) - OLD.quantity,
        updated_at = NOW()
    WHERE id = OLD.variant_id;
  ELSE
    -- Deduct from product stock
    UPDATE products
    SET stock_quantity = COALESCE(stock_quantity, 0) - OLD.quantity,
        updated_at = NOW()
    WHERE id = OLD.product_id;
  END IF;

  -- Delete associated inventory layer
  DELETE FROM inventory_layers
  WHERE purchase_item_id = OLD.id;

  RETURN OLD;
END;
$function$;

-- 3. Create trigger to deduct stock when purchase items are deleted
DROP TRIGGER IF EXISTS deduct_stock_on_purchase_item_delete_trigger ON purchase_items;
CREATE TRIGGER deduct_stock_on_purchase_item_delete_trigger
  BEFORE DELETE ON purchase_items
  FOR EACH ROW
  EXECUTE FUNCTION deduct_stock_on_purchase_item_delete();