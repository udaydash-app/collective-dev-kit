-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_stock_on_purchase_trigger ON purchase_items;

-- Update the trigger function to correctly set cost_price
CREATE OR REPLACE FUNCTION public.update_stock_on_purchase()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Update product stock and cost if no variant
  IF NEW.variant_id IS NULL THEN
    UPDATE products
    SET stock_quantity = stock_quantity + NEW.quantity,
        cost_price = NEW.unit_cost,  -- Fixed: was unit_price, should be unit_cost
        updated_at = NOW()
    WHERE id = NEW.product_id;
    
    -- Create inventory layer for FIFO with correct purchase_id link
    INSERT INTO inventory_layers (
      product_id,
      variant_id,
      purchase_id,
      purchase_item_id,
      quantity_purchased,
      quantity_remaining,
      unit_cost,
      purchased_at
    ) VALUES (
      NEW.product_id,
      NULL,
      NEW.purchase_id,
      NEW.id,
      NEW.quantity,
      NEW.quantity,
      NEW.unit_cost,
      NOW()
    );
  ELSE
    -- Update variant stock AND cost_price
    UPDATE product_variants
    SET stock_quantity = stock_quantity + NEW.quantity,
        cost_price = NEW.unit_cost,  -- Added: update variant cost_price
        updated_at = NOW()
    WHERE id = NEW.variant_id;
    
    -- Create inventory layer for variant
    INSERT INTO inventory_layers (
      product_id,
      variant_id,
      purchase_id,
      purchase_item_id,
      quantity_purchased,
      quantity_remaining,
      unit_cost,
      purchased_at
    ) VALUES (
      NEW.product_id,
      NEW.variant_id,
      NEW.purchase_id,
      NEW.id,
      NEW.quantity,
      NEW.quantity,
      NEW.unit_cost,
      NOW()
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create the trigger on purchase_items table
CREATE TRIGGER update_stock_on_purchase_trigger
  AFTER INSERT ON purchase_items
  FOR EACH ROW
  EXECUTE FUNCTION update_stock_on_purchase();