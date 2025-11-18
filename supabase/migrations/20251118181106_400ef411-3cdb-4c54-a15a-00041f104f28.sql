
-- Clean up orphaned inventory layers and fix stock for AMUL CHAAS SMALL 200ML
DO $$
DECLARE
  v_product_id UUID := 'b2cfa46b-4dab-48dd-a6d1-afe029c6b0cf';
  v_orphaned_quantity NUMERIC;
BEGIN
  -- Calculate total orphaned quantity
  SELECT COALESCE(SUM(il.quantity_remaining), 0)
  INTO v_orphaned_quantity
  FROM inventory_layers il
  LEFT JOIN purchase_items pi ON pi.id = il.purchase_item_id
  WHERE il.product_id = v_product_id
    AND il.quantity_remaining > 0
    AND (il.purchase_item_id IS NULL OR pi.id IS NULL);
  
  RAISE NOTICE 'Found % units in orphaned inventory layers', v_orphaned_quantity;
  
  -- Delete orphaned inventory layers
  DELETE FROM inventory_layers il
  WHERE il.product_id = v_product_id
    AND il.quantity_remaining > 0
    AND il.purchase_item_id IS NULL
    OR (
      il.product_id = v_product_id
      AND il.quantity_remaining > 0
      AND NOT EXISTS (
        SELECT 1 FROM purchase_items pi 
        WHERE pi.id = il.purchase_item_id
      )
    );
  
  RAISE NOTICE 'Deleted orphaned inventory layers';
  
  -- Reduce product stock by orphaned quantity
  UPDATE products
  SET stock_quantity = GREATEST(0, stock_quantity - v_orphaned_quantity),
      updated_at = NOW()
  WHERE id = v_product_id;
  
  RAISE NOTICE 'Reduced stock by % units', v_orphaned_quantity;
  
  -- Log final state
  RAISE NOTICE 'Cleanup complete for AMUL CHAAS SMALL 200ML';
END $$;

-- Verify the cleanup
SELECT 
  p.name,
  p.stock_quantity as current_stock,
  COUNT(il.id) as remaining_layers,
  COALESCE(SUM(il.quantity_remaining), 0) as total_layer_quantity
FROM products p
LEFT JOIN inventory_layers il ON il.product_id = p.id AND il.quantity_remaining > 0
WHERE p.id = 'b2cfa46b-4dab-48dd-a6d1-afe029c6b0cf'
GROUP BY p.id, p.name, p.stock_quantity;
