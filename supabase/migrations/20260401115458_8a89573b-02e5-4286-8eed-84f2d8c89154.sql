
-- Trigger to deduct stock when an online order status changes to 'delivered'
CREATE OR REPLACE FUNCTION public.deduct_stock_on_order_delivered()
RETURNS trigger AS $$
DECLARE
  item RECORD;
BEGIN
  -- Only fire when status changes TO 'delivered'
  IF (TG_OP = 'UPDATE' AND NEW.status = 'delivered' AND (OLD.status IS DISTINCT FROM 'delivered')) THEN
    -- Deduct stock for each order item
    FOR item IN
      SELECT oi.product_id, oi.quantity
      FROM order_items oi
      WHERE oi.order_id = NEW.id
    LOOP
      UPDATE products
      SET stock_quantity = stock_quantity - item.quantity,
          updated_at = now()
      WHERE id = item.product_id;
    END LOOP;
  END IF;

  -- Restore stock if status changes FROM 'delivered' to something else (e.g. cancelled)
  IF (TG_OP = 'UPDATE' AND OLD.status = 'delivered' AND NEW.status IS DISTINCT FROM 'delivered') THEN
    FOR item IN
      SELECT oi.product_id, oi.quantity
      FROM order_items oi
      WHERE oi.order_id = NEW.id
    LOOP
      UPDATE products
      SET stock_quantity = stock_quantity + item.quantity,
          updated_at = now()
      WHERE id = item.product_id;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS deduct_stock_on_order_delivered_trigger ON orders;
CREATE TRIGGER deduct_stock_on_order_delivered_trigger
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION public.deduct_stock_on_order_delivered();

-- Fix the current stock for Sesame Oil 500ml (product_id: 10d67863-8998-4d2b-b803-448fb80e84ef)
-- It was delivered but stock wasn't deducted, so deduct 1
UPDATE products
SET stock_quantity = stock_quantity - 1, updated_at = now()
WHERE id = '10d67863-8998-4d2b-b803-448fb80e84ef';
