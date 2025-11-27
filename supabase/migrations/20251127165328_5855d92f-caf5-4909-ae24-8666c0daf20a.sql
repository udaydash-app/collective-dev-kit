
-- Remove FIFO inventory system and switch to simple stock tracking

-- 1. Drop the FIFO stock deduction trigger and function
DROP TRIGGER IF EXISTS trigger_deduct_stock_fifo ON pos_transactions;
DROP FUNCTION IF EXISTS deduct_stock_fifo();

-- 2. Drop the purchase inventory layer creation trigger
DROP TRIGGER IF EXISTS create_inventory_layers_on_purchase ON purchases;
DROP FUNCTION IF EXISTS create_inventory_layers_from_purchase();

-- 3. Create new simple stock deduction trigger for POS transactions
CREATE OR REPLACE FUNCTION deduct_stock_simple()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item jsonb;
  product_rec record;
BEGIN
  -- Loop through all items in the transaction
  FOR item IN SELECT * FROM jsonb_array_elements(NEW.items)
  LOOP
    -- Get product details
    SELECT id, stock_quantity INTO product_rec
    FROM products
    WHERE id = (item->>'productId')::uuid;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    -- Deduct stock from product or variant
    IF item->>'variantId' IS NOT NULL AND item->>'variantId' != '' THEN
      -- Update variant stock
      UPDATE product_variants
      SET stock_quantity = GREATEST(0, stock_quantity - (item->>'quantity')::numeric)
      WHERE id = (item->>'variantId')::uuid;
    ELSE
      -- Update product stock
      UPDATE products
      SET stock_quantity = GREATEST(0, stock_quantity - (item->>'quantity')::numeric)
      WHERE id = (item->>'productId')::uuid;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Apply the simple stock deduction trigger
CREATE TRIGGER trigger_deduct_stock_simple
  AFTER INSERT ON pos_transactions
  FOR EACH ROW
  EXECUTE FUNCTION deduct_stock_simple();

-- 4. Create trigger to add stock when purchases are created
CREATE OR REPLACE FUNCTION add_stock_from_purchase()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item record;
BEGIN
  -- Loop through purchase items and add stock
  FOR item IN 
    SELECT product_id, variant_id, quantity
    FROM purchase_items
    WHERE purchase_id = NEW.id
  LOOP
    IF item.variant_id IS NOT NULL THEN
      -- Update variant stock
      UPDATE product_variants
      SET stock_quantity = COALESCE(stock_quantity, 0) + item.quantity
      WHERE id = item.variant_id;
    ELSE
      -- Update product stock
      UPDATE products
      SET stock_quantity = COALESCE(stock_quantity, 0) + item.quantity
      WHERE id = item.product_id;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Apply the purchase stock addition trigger
CREATE TRIGGER trigger_add_stock_from_purchase
  AFTER INSERT ON purchases
  FOR EACH ROW
  EXECUTE FUNCTION add_stock_from_purchase();

-- 5. Note: Keep inventory_layers table for historical data, but it won't be used going forward
COMMENT ON TABLE inventory_layers IS 'Historical FIFO data - no longer actively used. Stock is now tracked directly in products.stock_quantity and product_variants.stock_quantity';
