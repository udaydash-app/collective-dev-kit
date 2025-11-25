-- Fix ambiguous column reference in deduct_stock_fifo function
-- The issue is that output column names (unit_cost, layer_id, etc.) conflict with assignments

CREATE OR REPLACE FUNCTION public.deduct_stock_fifo(
  p_product_id UUID,
  p_variant_id UUID,
  p_quantity NUMERIC
) RETURNS TABLE (
  layer_id UUID,
  quantity_used NUMERIC,
  unit_cost NUMERIC,
  total_cogs NUMERIC
) AS $$
DECLARE
  v_remaining_qty NUMERIC := p_quantity;
  v_layer RECORD;
  v_qty_to_deduct NUMERIC;
  v_layer_id UUID;
  v_quantity_used NUMERIC;
  v_unit_cost NUMERIC;
  v_total_cogs NUMERIC;
BEGIN
  -- Get layers in FIFO order (oldest first)
  FOR v_layer IN 
    SELECT il.id, il.quantity_remaining, il.unit_cost
    FROM inventory_layers il
    WHERE il.product_id = p_product_id
      AND (p_variant_id IS NULL AND il.variant_id IS NULL OR il.variant_id = p_variant_id)
      AND il.quantity_remaining > 0
    ORDER BY il.purchased_at ASC, il.created_at ASC
    FOR UPDATE
  LOOP
    -- Calculate how much to deduct from this layer
    v_qty_to_deduct := LEAST(v_layer.quantity_remaining, v_remaining_qty);
    
    -- Assign to local variables first
    v_layer_id := v_layer.id;
    v_quantity_used := v_qty_to_deduct;
    v_unit_cost := v_layer.unit_cost;
    v_total_cogs := v_qty_to_deduct * v_layer.unit_cost;
    
    -- Return this layer's COGS contribution
    layer_id := v_layer_id;
    quantity_used := v_quantity_used;
    unit_cost := v_unit_cost;
    total_cogs := v_total_cogs;
    RETURN NEXT;
    
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
    RAISE EXCEPTION 'Insufficient inventory layers for product %. Short by % units.', 
      p_product_id, v_remaining_qty;
  END IF;
  
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;