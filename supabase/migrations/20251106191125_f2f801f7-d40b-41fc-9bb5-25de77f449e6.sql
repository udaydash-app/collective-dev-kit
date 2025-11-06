-- Fix all purchases made today that were affected by duplicate triggers
-- This corrects stock quantities that were tripled

DO $$
DECLARE
  v_item RECORD;
  v_correct_stock NUMERIC;
BEGIN
  -- Find all purchase items created today with duplicate inventory layers
  FOR v_item IN 
    SELECT DISTINCT
      il.product_id,
      il.variant_id,
      il.purchase_item_id,
      COUNT(*) as duplicate_count,
      MAX(il.quantity_purchased) as correct_quantity
    FROM inventory_layers il
    INNER JOIN purchase_items pi ON il.purchase_item_id = pi.id
    WHERE DATE(pi.created_at) = CURRENT_DATE
      AND il.purchase_item_id IS NOT NULL
    GROUP BY il.product_id, il.variant_id, il.purchase_item_id
    HAVING COUNT(*) > 1
  LOOP
    -- Keep only the oldest inventory layer (by created_at), delete the rest
    DELETE FROM inventory_layers
    WHERE id IN (
      SELECT id FROM inventory_layers
      WHERE product_id = v_item.product_id
        AND (variant_id = v_item.variant_id OR (variant_id IS NULL AND v_item.variant_id IS NULL))
        AND purchase_item_id = v_item.purchase_item_id
      ORDER BY created_at ASC
      OFFSET 1  -- Keep the first one, delete the rest
    );
    
    RAISE NOTICE 'Removed duplicates for product_id: %, variant_id: %, purchase_item_id: %', 
      v_item.product_id, v_item.variant_id, v_item.purchase_item_id;
  END LOOP;
  
  -- Now recalculate stock for all affected products
  FOR v_item IN 
    SELECT DISTINCT
      il.product_id,
      il.variant_id
    FROM inventory_layers il
    INNER JOIN purchase_items pi ON il.purchase_item_id = pi.id
    WHERE DATE(pi.created_at) = CURRENT_DATE
  LOOP
    IF v_item.variant_id IS NULL THEN
      -- For products without variants, sum all inventory layers
      SELECT COALESCE(SUM(quantity_remaining), 0) INTO v_correct_stock
      FROM inventory_layers
      WHERE product_id = v_item.product_id AND variant_id IS NULL;
      
      UPDATE products
      SET stock_quantity = v_correct_stock,
          updated_at = NOW()
      WHERE id = v_item.product_id;
      
      RAISE NOTICE 'Updated product stock: product_id=%, stock=%', v_item.product_id, v_correct_stock;
    ELSE
      -- For product variants, sum inventory layers for that variant
      SELECT COALESCE(SUM(quantity_remaining), 0) INTO v_correct_stock
      FROM inventory_layers
      WHERE variant_id = v_item.variant_id;
      
      UPDATE product_variants
      SET stock_quantity = v_correct_stock,
          updated_at = NOW()
      WHERE id = v_item.variant_id;
      
      RAISE NOTICE 'Updated variant stock: variant_id=%, stock=%', v_item.variant_id, v_correct_stock;
    END IF;
  END LOOP;
END $$;