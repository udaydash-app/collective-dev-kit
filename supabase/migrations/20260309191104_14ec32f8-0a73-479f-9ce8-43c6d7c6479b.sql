-- Create a function to recalculate stock, then call it
-- This runs as a database function to avoid timeout issues

CREATE OR REPLACE FUNCTION public.recalculate_all_stock()
RETURNS TABLE(updated_products integer, updated_variants integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_products_updated integer := 0;
  v_variants_updated integer := 0;
BEGIN
  -- Recalculate product-level stock
  WITH calculations AS (
    SELECT 
      p.id,
      COALESCE((
        SELECT SUM(pi.quantity) FROM purchase_items pi
        WHERE pi.product_id = p.id AND pi.variant_id IS NULL
      ), 0)
      -
      COALESCE((
        SELECT SUM((item->>'quantity')::numeric)
        FROM pos_transactions pt, jsonb_array_elements(pt.items) as item
        WHERE (item->>'productId')::text = p.id::text
          AND item->>'productId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          AND (item->>'variantId' IS NULL OR item->>'variantId' = '')
      ), 0)
      +
      COALESCE((
        SELECT SUM(sa.quantity_change) FROM stock_adjustments sa
        WHERE sa.product_id = p.id AND sa.variant_id IS NULL
      ), 0) AS new_stock
    FROM products p
    WHERE EXISTS (
        SELECT 1 FROM purchase_items pi WHERE pi.product_id = p.id AND pi.variant_id IS NULL
      ) OR EXISTS (
        SELECT 1 FROM pos_transactions pt, jsonb_array_elements(pt.items) as item
        WHERE (item->>'productId')::text = p.id::text
          AND item->>'productId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          AND (item->>'variantId' IS NULL OR item->>'variantId' = '')
      )
  )
  UPDATE products p
  SET stock_quantity = c.new_stock, updated_at = NOW()
  FROM calculations c
  WHERE p.id = c.id AND p.stock_quantity IS DISTINCT FROM c.new_stock;
  
  GET DIAGNOSTICS v_products_updated = ROW_COUNT;

  -- Recalculate variant-level stock
  WITH variant_calculations AS (
    SELECT
      pv.id,
      COALESCE((
        SELECT SUM(pi.quantity) FROM purchase_items pi WHERE pi.variant_id = pv.id
      ), 0)
      -
      COALESCE((
        SELECT SUM((item->>'quantity')::numeric)
        FROM pos_transactions pt, jsonb_array_elements(pt.items) as item
        WHERE (item->>'variantId')::text = pv.id::text
          AND item->>'variantId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      ), 0)
      +
      COALESCE((
        SELECT SUM(sa.quantity_change) FROM stock_adjustments sa WHERE sa.variant_id = pv.id
      ), 0) AS new_stock
    FROM product_variants pv
    WHERE EXISTS (
        SELECT 1 FROM purchase_items pi WHERE pi.variant_id = pv.id
      ) OR EXISTS (
        SELECT 1 FROM pos_transactions pt, jsonb_array_elements(pt.items) as item
        WHERE (item->>'variantId')::text = pv.id::text
          AND item->>'variantId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      )
  )
  UPDATE product_variants pv
  SET stock_quantity = vc.new_stock, updated_at = NOW()
  FROM variant_calculations vc
  WHERE pv.id = vc.id AND pv.stock_quantity IS DISTINCT FROM vc.new_stock;
  
  GET DIAGNOSTICS v_variants_updated = ROW_COUNT;

  RETURN QUERY SELECT v_products_updated, v_variants_updated;
END;
$$;