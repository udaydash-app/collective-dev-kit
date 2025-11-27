-- Function to restore stock when a POS transaction is deleted
CREATE OR REPLACE FUNCTION restore_stock_on_transaction_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item RECORD;
  v_quantity NUMERIC;
BEGIN
  -- Loop through all items in the deleted transaction
  FOR v_item IN SELECT * FROM jsonb_array_elements(OLD.items)
  LOOP
    -- Extract quantity (handle both direct quantity and potential nested structure)
    v_quantity := COALESCE(
      (v_item.value->>'quantity')::numeric,
      1
    );

    -- Restore stock to variant if variant_id exists
    IF v_item.value->>'variant_id' IS NOT NULL AND v_item.value->>'variant_id' != '' THEN
      UPDATE product_variants
      SET 
        quantity = COALESCE(quantity, 0) + v_quantity,
        updated_at = now()
      WHERE id = (v_item.value->>'variant_id')::uuid;
      
      RAISE NOTICE 'Restored % units to variant %', v_quantity, v_item.value->>'variant_id';
    -- Otherwise restore to product
    ELSIF v_item.value->>'product_id' IS NOT NULL THEN
      UPDATE products
      SET 
        stock_quantity = COALESCE(stock_quantity, 0) + v_quantity,
        updated_at = now()
      WHERE id = (v_item.value->>'product_id')::uuid;
      
      RAISE NOTICE 'Restored % units to product %', v_quantity, v_item.value->>'product_id';
    END IF;
  END LOOP;

  RETURN OLD;
END;
$$;

-- Create trigger for stock restoration on transaction deletion
DROP TRIGGER IF EXISTS restore_stock_on_pos_transaction_delete ON pos_transactions;
CREATE TRIGGER restore_stock_on_pos_transaction_delete
  BEFORE DELETE ON pos_transactions
  FOR EACH ROW
  EXECUTE FUNCTION restore_stock_on_transaction_delete();