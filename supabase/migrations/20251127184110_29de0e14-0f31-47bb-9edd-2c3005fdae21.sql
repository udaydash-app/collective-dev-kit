-- Fix stock restoration trigger with correct field names
CREATE OR REPLACE FUNCTION restore_stock_on_transaction_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item RECORD;
  v_quantity NUMERIC;
  v_variant_id TEXT;
  v_product_id TEXT;
BEGIN
  RAISE NOTICE 'Starting stock restoration for transaction %', OLD.id;
  RAISE NOTICE 'Transaction items: %', OLD.items;
  
  -- Loop through all items in the deleted transaction
  FOR v_item IN SELECT * FROM jsonb_array_elements(OLD.items)
  LOOP
    -- Extract values using camelCase field names
    v_quantity := COALESCE((v_item.value->>'quantity')::numeric, 1);
    v_variant_id := v_item.value->>'variantId';  -- Changed from variant_id
    v_product_id := v_item.value->>'productId';  -- Changed from product_id
    
    RAISE NOTICE 'Processing item - Product: %, Variant: %, Quantity: %', v_product_id, v_variant_id, v_quantity;
    
    -- Restore stock to variant if variantId exists and is not empty
    IF v_variant_id IS NOT NULL AND v_variant_id != '' AND v_variant_id != 'null' THEN
      UPDATE product_variants
      SET 
        stock_quantity = COALESCE(stock_quantity, 0) + v_quantity,
        updated_at = now()
      WHERE id = v_variant_id::uuid;
      
      IF FOUND THEN
        RAISE NOTICE '✅ Restored % units to variant %', v_quantity, v_variant_id;
      ELSE
        RAISE WARNING '⚠️ Variant % not found', v_variant_id;
      END IF;
    -- Otherwise restore to product if productId exists
    ELSIF v_product_id IS NOT NULL AND v_product_id != '' THEN
      UPDATE products
      SET 
        stock_quantity = COALESCE(stock_quantity, 0) + v_quantity,
        updated_at = now()
      WHERE id = v_product_id::uuid;
      
      IF FOUND THEN
        RAISE NOTICE '✅ Restored % units to product %', v_quantity, v_product_id;
      ELSE
        RAISE WARNING '⚠️ Product % not found', v_product_id;
      END IF;
    ELSE
      RAISE WARNING '⚠️ No valid productId or variantId for item';
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Completed stock restoration for transaction %', OLD.id;
  RETURN OLD;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error restoring stock for transaction %: %', OLD.id, SQLERRM;
    RETURN OLD;
END;
$$;