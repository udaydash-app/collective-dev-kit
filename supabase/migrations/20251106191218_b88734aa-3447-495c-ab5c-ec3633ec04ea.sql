-- Recalculate stock for all products purchased today based on ALL inventory layers
-- This ensures stock matches the sum of all inventory layers

DO $$
DECLARE
  v_product RECORD;
  v_correct_stock NUMERIC;
BEGIN
  -- For all products purchased today (including those with existing inventory)
  FOR v_product IN 
    SELECT DISTINCT
      p.id as product_id,
      p.name,
      p.stock_quantity as current_stock
    FROM products p
    INNER JOIN inventory_layers il ON p.id = il.product_id
    INNER JOIN purchase_items pi ON il.purchase_item_id = pi.id
    WHERE DATE(pi.created_at) = CURRENT_DATE
      AND il.variant_id IS NULL
  LOOP
    -- Calculate correct stock from ALL inventory layers (not just today)
    SELECT COALESCE(SUM(quantity_remaining), 0) INTO v_correct_stock
    FROM inventory_layers
    WHERE product_id = v_product.product_id 
      AND variant_id IS NULL;
    
    -- Only update if there's a mismatch
    IF v_correct_stock != v_product.current_stock THEN
      UPDATE products
      SET stock_quantity = v_correct_stock,
          updated_at = NOW()
      WHERE id = v_product.product_id;
      
      RAISE NOTICE 'Fixed % from % to %', v_product.name, v_product.current_stock, v_correct_stock;
    END IF;
  END LOOP;
  
  -- Same for variants
  FOR v_product IN 
    SELECT DISTINCT
      pv.id as variant_id,
      p.name || ' (' || pv.label || ')' as name,
      pv.stock_quantity as current_stock
    FROM product_variants pv
    INNER JOIN products p ON pv.product_id = p.id
    INNER JOIN inventory_layers il ON pv.id = il.variant_id
    INNER JOIN purchase_items pi ON il.purchase_item_id = pi.id
    WHERE DATE(pi.created_at) = CURRENT_DATE
  LOOP
    SELECT COALESCE(SUM(quantity_remaining), 0) INTO v_correct_stock
    FROM inventory_layers
    WHERE variant_id = v_product.variant_id;
    
    IF v_correct_stock != v_product.current_stock THEN
      UPDATE product_variants
      SET stock_quantity = v_correct_stock,
          updated_at = NOW()
      WHERE id = v_product.variant_id;
      
      RAISE NOTICE 'Fixed variant % from % to %', v_product.name, v_product.current_stock, v_correct_stock;
    END IF;
  END LOOP;
END $$;