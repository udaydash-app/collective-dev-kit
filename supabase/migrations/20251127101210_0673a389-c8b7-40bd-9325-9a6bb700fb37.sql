-- Create batch FIFO deduction function to handle multiple products in one call
-- This dramatically reduces round trips for transactions with many items

CREATE OR REPLACE FUNCTION public.deduct_stock_fifo_batch(
  p_items JSONB -- Array of {product_id, variant_id, quantity, name}
) RETURNS TABLE (
  item_index INTEGER,
  product_id UUID,
  variant_id UUID,
  name TEXT,
  total_cogs NUMERIC,
  layers JSONB
) AS $$
DECLARE
  v_item JSONB;
  v_item_index INTEGER := 0;
  v_product_id UUID;
  v_variant_id UUID;
  v_quantity NUMERIC;
  v_name TEXT;
  v_remaining_qty NUMERIC;
  v_layer RECORD;
  v_qty_to_deduct NUMERIC;
  v_item_cogs NUMERIC := 0;
  v_layers JSONB := '[]'::JSONB;
  v_layer_data JSONB;
BEGIN
  -- Process each item in the batch
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_variant_id := CASE WHEN v_item->>'variant_id' IS NOT NULL AND v_item->>'variant_id' != '' AND v_item->>'variant_id' != 'null' 
                         THEN (v_item->>'variant_id')::UUID 
                         ELSE NULL END;
    v_quantity := (v_item->>'quantity')::NUMERIC;
    v_name := v_item->>'name';
    v_remaining_qty := v_quantity;
    v_item_cogs := 0;
    v_layers := '[]'::JSONB;
    
    -- Get layers in FIFO order for this product
    FOR v_layer IN 
      SELECT il.id, il.quantity_remaining, il.unit_cost
      FROM inventory_layers il
      WHERE il.product_id = v_product_id
        AND (v_variant_id IS NULL AND il.variant_id IS NULL OR il.variant_id = v_variant_id)
        AND il.quantity_remaining > 0
      ORDER BY il.purchased_at ASC, il.created_at ASC
      FOR UPDATE
    LOOP
      -- Calculate how much to deduct from this layer
      v_qty_to_deduct := LEAST(v_layer.quantity_remaining, v_remaining_qty);
      
      -- Build layer data
      v_layer_data := jsonb_build_object(
        'layer_id', v_layer.id,
        'quantity_used', v_qty_to_deduct,
        'unit_cost', v_layer.unit_cost,
        'total_cogs', v_qty_to_deduct * v_layer.unit_cost
      );
      
      -- Add to layers array
      v_layers := v_layers || v_layer_data;
      
      -- Accumulate COGS
      v_item_cogs := v_item_cogs + (v_qty_to_deduct * v_layer.unit_cost);
      
      -- Update the layer
      UPDATE inventory_layers
      SET quantity_remaining = quantity_remaining - v_qty_to_deduct,
          updated_at = NOW()
      WHERE id = v_layer.id;
      
      -- Reduce remaining quantity needed
      v_remaining_qty := v_remaining_qty - v_qty_to_deduct;
      
      -- Exit if we've deducted enough
      EXIT WHEN v_remaining_qty <= 0;
    END LOOP;
    
    -- Check if we couldn't deduct the full quantity
    IF v_remaining_qty > 0 THEN
      RAISE EXCEPTION 'Insufficient inventory layers for product % (%). Short by % units.', 
        v_name, v_product_id, v_remaining_qty;
    END IF;
    
    -- Return this item's result
    item_index := v_item_index;
    product_id := v_product_id;
    variant_id := v_variant_id;
    name := v_name;
    total_cogs := v_item_cogs;
    layers := v_layers;
    RETURN NEXT;
    
    v_item_index := v_item_index + 1;
  END LOOP;
  
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Add index on inventory_layers if not exists to speed up FIFO queries
CREATE INDEX IF NOT EXISTS idx_inventory_layers_fifo_lookup 
ON inventory_layers (product_id, variant_id, purchased_at, created_at) 
WHERE quantity_remaining > 0;