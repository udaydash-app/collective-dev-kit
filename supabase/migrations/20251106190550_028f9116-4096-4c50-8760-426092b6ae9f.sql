-- Fix duplicate inventory layers and incorrect stock for existing purchases
-- This corrects the stock that was multiplied by the duplicate triggers

DO $$
DECLARE
  v_product RECORD;
  v_correct_stock NUMERIC;
BEGIN
  -- For each product that has duplicate inventory layers from the same purchase_item
  FOR v_product IN 
    SELECT 
      il.product_id,
      il.variant_id,
      il.purchase_item_id,
      COUNT(*) as duplicate_count,
      MAX(il.quantity_purchased) as quantity
    FROM inventory_layers il
    WHERE il.purchase_item_id IS NOT NULL
    GROUP BY il.product_id, il.variant_id, il.purchase_item_id
    HAVING COUNT(*) > 1
  LOOP
    -- Keep only one inventory layer (the first one by created_at)
    DELETE FROM inventory_layers
    WHERE id IN (
      SELECT id FROM inventory_layers
      WHERE product_id = v_product.product_id
        AND (variant_id = v_product.variant_id OR (variant_id IS NULL AND v_product.variant_id IS NULL))
        AND purchase_item_id = v_product.purchase_item_id
      ORDER BY created_at DESC
      OFFSET 1
    );
    
    -- Recalculate correct stock from inventory layers
    IF v_product.variant_id IS NULL THEN
      -- For products without variants
      SELECT COALESCE(SUM(quantity_remaining), 0) INTO v_correct_stock
      FROM inventory_layers
      WHERE product_id = v_product.product_id AND variant_id IS NULL;
      
      UPDATE products
      SET stock_quantity = v_correct_stock
      WHERE id = v_product.product_id;
    ELSE
      -- For product variants
      SELECT COALESCE(SUM(quantity_remaining), 0) INTO v_correct_stock
      FROM inventory_layers
      WHERE variant_id = v_product.variant_id;
      
      UPDATE product_variants
      SET stock_quantity = v_correct_stock
      WHERE id = v_product.variant_id;
    END IF;
  END LOOP;
END $$;