-- Add detailed logging to deduction function
CREATE OR REPLACE FUNCTION deduct_stock_simple()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  item jsonb;
  product_rec record;
BEGIN
  RAISE NOTICE 'DEDUCT TRIGGER FIRED for transaction %', NEW.transaction_number;
  
  -- Loop through all items in the transaction
  FOR item IN SELECT * FROM jsonb_array_elements(NEW.items)
  LOOP
    RAISE NOTICE 'Processing item: productId=%, variantId=%, quantity=%', 
      item->>'productId', item->>'variantId', item->>'quantity';
    
    -- Get product details
    SELECT id, stock_quantity INTO product_rec
    FROM products
    WHERE id = (item->>'productId')::uuid;

    IF NOT FOUND THEN
      RAISE NOTICE 'Product not found: %', item->>'productId';
      CONTINUE;
    END IF;

    RAISE NOTICE 'Found product with current stock: %', product_rec.stock_quantity;

    -- Deduct stock from product or variant (allow negative values)
    IF item->>'variantId' IS NOT NULL AND item->>'variantId' != '' THEN
      RAISE NOTICE 'Deducting from variant %', item->>'variantId';
      -- Update variant stock (allow negative)
      UPDATE product_variants
      SET stock_quantity = stock_quantity - (item->>'quantity')::numeric,
          updated_at = now()
      WHERE id = (item->>'variantId')::uuid;
      RAISE NOTICE 'Variant stock updated';
    ELSE
      RAISE NOTICE 'Deducting % from product %', (item->>'quantity')::numeric, item->>'productId';
      -- Update product stock (allow negative)
      UPDATE products
      SET stock_quantity = stock_quantity - (item->>'quantity')::numeric,
          updated_at = now()
      WHERE id = (item->>'productId')::uuid;
      RAISE NOTICE 'Product stock updated';
    END IF;
  END LOOP;

  RAISE NOTICE 'DEDUCT TRIGGER COMPLETED for transaction %', NEW.transaction_number;
  RETURN NEW;
END;
$$;

-- Add detailed logging to restoration function
CREATE OR REPLACE FUNCTION restore_stock_on_transaction_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_item RECORD;
  v_quantity NUMERIC;
BEGIN
  RAISE NOTICE 'RESTORE TRIGGER FIRED for transaction %', OLD.transaction_number;
  
  -- Loop through all items in the deleted transaction
  FOR v_item IN SELECT * FROM jsonb_array_elements(OLD.items)
  LOOP
    RAISE NOTICE 'Restoring item: productId=%, variantId=%, quantity=%',
      v_item.value->>'productId', v_item.value->>'variantId', v_item.value->>'quantity';
    
    -- Extract quantity
    v_quantity := COALESCE(
      (v_item.value->>'quantity')::numeric,
      1
    );

    -- Restore stock to variant if variantId exists (using camelCase to match deduction)
    IF v_item.value->>'variantId' IS NOT NULL AND v_item.value->>'variantId' != '' THEN
      UPDATE product_variants
      SET 
        stock_quantity = COALESCE(stock_quantity, 0) + v_quantity,
        updated_at = now()
      WHERE id = (v_item.value->>'variantId')::uuid;
      
      RAISE NOTICE 'Restored % units to variant %', v_quantity, v_item.value->>'variantId';
    -- Otherwise restore to product (using camelCase to match deduction)
    ELSIF v_item.value->>'productId' IS NOT NULL THEN
      UPDATE products
      SET 
        stock_quantity = COALESCE(stock_quantity, 0) + v_quantity,
        updated_at = now()
      WHERE id = (v_item.value->>'productId')::uuid;
      
      RAISE NOTICE 'Restored % units to product %', v_quantity, v_item.value->>'productId';
    END IF;
  END LOOP;

  RAISE NOTICE 'RESTORE TRIGGER COMPLETED for transaction %', OLD.transaction_number;
  RETURN OLD;
END;
$$;