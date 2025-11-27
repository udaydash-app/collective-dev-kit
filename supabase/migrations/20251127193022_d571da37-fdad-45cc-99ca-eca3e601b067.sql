-- Fix stock restoration trigger to use correct camelCase field names
CREATE OR REPLACE FUNCTION restore_stock_on_transaction_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item RECORD;
  v_quantity NUMERIC;
BEGIN
  -- Loop through all items in the deleted transaction
  FOR v_item IN SELECT * FROM jsonb_array_elements(OLD.items)
  LOOP
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

  RETURN OLD;
END;
$$;