
-- Clean up orphaned inventory layers for ALL products
DO $$
DECLARE
  v_product RECORD;
  v_orphaned_quantity NUMERIC;
  v_total_products INTEGER := 0;
  v_total_orphaned_units NUMERIC := 0;
BEGIN
  -- Loop through each product that has orphaned inventory layers
  FOR v_product IN 
    SELECT DISTINCT p.id, p.name
    FROM products p
    INNER JOIN inventory_layers il ON il.product_id = p.id
    LEFT JOIN purchase_items pi ON pi.id = il.purchase_item_id
    WHERE il.quantity_remaining > 0
      AND (il.purchase_item_id IS NULL OR pi.id IS NULL)
  LOOP
    -- Calculate orphaned quantity for this product
    SELECT COALESCE(SUM(il.quantity_remaining), 0)
    INTO v_orphaned_quantity
    FROM inventory_layers il
    LEFT JOIN purchase_items pi ON pi.id = il.purchase_item_id
    WHERE il.product_id = v_product.id
      AND il.quantity_remaining > 0
      AND (il.purchase_item_id IS NULL OR pi.id IS NULL);
    
    IF v_orphaned_quantity > 0 THEN
      RAISE NOTICE 'Product: % - Found % orphaned units', v_product.name, v_orphaned_quantity;
      
      -- Delete orphaned inventory layers for this product
      DELETE FROM inventory_layers il
      WHERE il.product_id = v_product.id
        AND il.quantity_remaining > 0
        AND (
          il.purchase_item_id IS NULL
          OR NOT EXISTS (
            SELECT 1 FROM purchase_items pi 
            WHERE pi.id = il.purchase_item_id
          )
        );
      
      -- Reduce product stock
      UPDATE products
      SET stock_quantity = GREATEST(0, stock_quantity - v_orphaned_quantity),
          updated_at = NOW()
      WHERE id = v_product.id;
      
      v_total_products := v_total_products + 1;
      v_total_orphaned_units := v_total_orphaned_units + v_orphaned_quantity;
    END IF;
  END LOOP;
  
  RAISE NOTICE '==== CLEANUP COMPLETE ====';
  RAISE NOTICE 'Total products cleaned: %', v_total_products;
  RAISE NOTICE 'Total units removed: %', v_total_orphaned_units;
END $$;

-- Verify cleanup - show summary of remaining mismatches
SELECT 
  p.name,
  p.stock_quantity as product_stock,
  COALESCE(SUM(il.quantity_remaining), 0) as layer_stock,
  p.stock_quantity - COALESCE(SUM(il.quantity_remaining), 0) as difference
FROM products p
LEFT JOIN inventory_layers il ON il.product_id = p.id AND il.quantity_remaining > 0
GROUP BY p.id, p.name, p.stock_quantity
HAVING p.stock_quantity != COALESCE(SUM(il.quantity_remaining), 0)
ORDER BY ABS(p.stock_quantity - COALESCE(SUM(il.quantity_remaining), 0)) DESC
LIMIT 20;
