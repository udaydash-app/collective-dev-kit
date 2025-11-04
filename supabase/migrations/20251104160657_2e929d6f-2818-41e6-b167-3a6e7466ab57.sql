-- Retroactively deduct stock for all previous POS transactions
DO $$
DECLARE
  transaction_record RECORD;
  item_record JSONB;
BEGIN
  -- Loop through all pos_transactions
  FOR transaction_record IN 
    SELECT id, items FROM pos_transactions
  LOOP
    -- Loop through items in each transaction
    FOR item_record IN 
      SELECT * FROM jsonb_array_elements(transaction_record.items)
    LOOP
      -- Skip cart-discount items
      IF item_record->>'id' = 'cart-discount' THEN
        CONTINUE;
      END IF;
      
      -- Check if this is a variant or base product
      IF item_record->>'id' != COALESCE(item_record->>'productId', item_record->>'id') THEN
        -- Update variant stock
        PERFORM decrement_variant_stock(
          (item_record->>'id')::UUID,
          (item_record->>'quantity')::INTEGER
        );
      ELSE
        -- Update base product stock
        PERFORM decrement_product_stock(
          (item_record->>'id')::UUID,
          (item_record->>'quantity')::INTEGER
        );
      END IF;
    END LOOP;
  END LOOP;
  
  RAISE NOTICE 'Stock deducted for all previous transactions';
END $$;