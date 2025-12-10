-- Add trigger function to add stock when purchase items are inserted
CREATE OR REPLACE FUNCTION public.update_stock_on_purchase_item_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Add stock when purchase item is inserted
  IF NEW.variant_id IS NOT NULL THEN
    UPDATE product_variants
    SET stock_quantity = COALESCE(stock_quantity, 0) + NEW.quantity,
        cost_price = NEW.unit_cost,
        updated_at = NOW()
    WHERE id = NEW.variant_id;
  ELSE
    UPDATE products
    SET stock_quantity = COALESCE(stock_quantity, 0) + NEW.quantity,
        cost_price = NEW.unit_cost,
        updated_at = NOW()
    WHERE id = NEW.product_id;
  END IF;
  
  -- Create inventory layer for FIFO tracking
  INSERT INTO inventory_layers (
    product_id, variant_id, purchase_id, purchase_item_id,
    quantity_purchased, quantity_remaining, unit_cost, purchased_at
  ) VALUES (
    NEW.product_id, NEW.variant_id, NEW.purchase_id, NEW.id,
    NEW.quantity, NEW.quantity, NEW.unit_cost, NOW()
  );
  
  RETURN NEW;
END;
$$;

-- Create trigger for purchase item INSERT
DROP TRIGGER IF EXISTS update_stock_on_purchase_item_insert_trigger ON public.purchase_items;
CREATE TRIGGER update_stock_on_purchase_item_insert_trigger
  AFTER INSERT ON public.purchase_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_stock_on_purchase_item_insert();

-- Also add trigger for purchase item UPDATE (to handle quantity changes)
CREATE OR REPLACE FUNCTION public.update_stock_on_purchase_item_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  qty_diff numeric;
BEGIN
  qty_diff := NEW.quantity - OLD.quantity;
  
  -- Only adjust if quantity changed
  IF qty_diff != 0 THEN
    IF NEW.variant_id IS NOT NULL THEN
      UPDATE product_variants
      SET stock_quantity = COALESCE(stock_quantity, 0) + qty_diff,
          cost_price = NEW.unit_cost,
          updated_at = NOW()
      WHERE id = NEW.variant_id;
    ELSE
      UPDATE products
      SET stock_quantity = COALESCE(stock_quantity, 0) + qty_diff,
          cost_price = NEW.unit_cost,
          updated_at = NOW()
      WHERE id = NEW.product_id;
    END IF;
    
    -- Update inventory layer
    UPDATE inventory_layers
    SET quantity_purchased = NEW.quantity,
        quantity_remaining = quantity_remaining + qty_diff,
        unit_cost = NEW.unit_cost,
        updated_at = NOW()
    WHERE purchase_item_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for purchase item UPDATE
DROP TRIGGER IF EXISTS update_stock_on_purchase_item_update_trigger ON public.purchase_items;
CREATE TRIGGER update_stock_on_purchase_item_update_trigger
  BEFORE UPDATE ON public.purchase_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_stock_on_purchase_item_update();