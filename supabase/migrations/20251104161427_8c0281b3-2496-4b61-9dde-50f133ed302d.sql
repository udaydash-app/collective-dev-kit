-- Fix double-deducted stock from retroactive migration
-- Add back the stock that was deducted twice

DO $$
DECLARE
  transaction_record RECORD;
  item_record JSONB;
  product_stock INTEGER;
BEGIN
  -- Loop through all pos_transactions created BEFORE the stock deduction feature
  FOR transaction_record IN 
    SELECT id, items, created_at 
    FROM pos_transactions 
    WHERE created_at < '2025-11-04 16:00:00'::timestamp
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
        -- Add back variant stock (was deducted twice)
        UPDATE product_variants
        SET 
          stock_quantity = stock_quantity + (item_record->>'quantity')::INTEGER,
          updated_at = now()
        WHERE id = (item_record->>'id')::UUID;
      ELSE
        -- Add back base product stock (was deducted twice)
        UPDATE products
        SET 
          stock_quantity = stock_quantity + (item_record->>'quantity')::INTEGER,
          updated_at = now()
        WHERE id = (item_record->>'id')::UUID;
      END IF;
    END LOOP;
  END LOOP;
  
  RAISE NOTICE 'Fixed double-deducted stock for transactions before stock feature was implemented';
END $$;