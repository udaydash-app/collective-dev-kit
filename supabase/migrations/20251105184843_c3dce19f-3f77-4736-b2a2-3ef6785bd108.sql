-- Enhance stock_adjustments table to track FIFO layer information
ALTER TABLE stock_adjustments 
ADD COLUMN IF NOT EXISTS inventory_layer_id uuid REFERENCES inventory_layers(id),
ADD COLUMN IF NOT EXISTS unit_cost numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_value numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS cogs_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS cost_source text DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS journal_entry_id uuid REFERENCES journal_entries(id);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_layer ON stock_adjustments(inventory_layer_id);
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_product ON stock_adjustments(product_id);

-- Function to create adjustment layer for stock increases
CREATE OR REPLACE FUNCTION create_adjustment_layer(
  p_product_id uuid,
  p_variant_id uuid,
  p_quantity numeric,
  p_unit_cost numeric,
  p_adjustment_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_layer_id uuid;
BEGIN
  -- Create new inventory layer for the adjustment
  INSERT INTO inventory_layers (
    product_id,
    variant_id,
    purchase_id,
    purchase_item_id,
    quantity_purchased,
    quantity_remaining,
    unit_cost,
    purchased_at
  ) VALUES (
    p_product_id,
    p_variant_id,
    NULL,
    NULL,
    p_quantity,
    p_quantity,
    p_unit_cost,
    NOW()
  ) RETURNING id INTO v_layer_id;

  -- Update stock adjustment record with layer reference
  IF p_adjustment_id IS NOT NULL THEN
    UPDATE stock_adjustments
    SET inventory_layer_id = v_layer_id,
        unit_cost = p_unit_cost,
        total_value = p_quantity * p_unit_cost
    WHERE id = p_adjustment_id;
  END IF;

  RETURN v_layer_id;
END;
$$;

-- Function to get suggested cost for adjustment
CREATE OR REPLACE FUNCTION get_suggested_adjustment_cost(
  p_product_id uuid,
  p_variant_id uuid DEFAULT NULL
)
RETURNS TABLE(
  last_purchase_cost numeric,
  weighted_avg_cost numeric,
  next_fifo_cost numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    -- Last purchase cost
    (SELECT unit_cost 
     FROM inventory_layers 
     WHERE product_id = p_product_id 
       AND (p_variant_id IS NULL AND variant_id IS NULL OR variant_id = p_variant_id)
     ORDER BY purchased_at DESC 
     LIMIT 1),
    
    -- Weighted average cost
    (SELECT COALESCE(
       SUM(quantity_remaining * unit_cost) / NULLIF(SUM(quantity_remaining), 0),
       0
     )
     FROM inventory_layers
     WHERE product_id = p_product_id
       AND (p_variant_id IS NULL AND variant_id IS NULL OR variant_id = p_variant_id)
       AND quantity_remaining > 0),
    
    -- Next FIFO cost (oldest layer)
    (SELECT unit_cost
     FROM inventory_layers
     WHERE product_id = p_product_id
       AND (p_variant_id IS NULL AND variant_id IS NULL OR variant_id = p_variant_id)
       AND quantity_remaining > 0
     ORDER BY purchased_at ASC, created_at ASC
     LIMIT 1);
END;
$$;

-- Function to handle stock adjustment with accounting
CREATE OR REPLACE FUNCTION handle_stock_adjustment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_inventory_account_id uuid;
  v_adjustment_account_id uuid;
  v_journal_entry_id uuid;
  v_cogs_layers jsonb;
  v_total_cogs numeric := 0;
  v_layer record;
BEGIN
  -- Get account IDs
  SELECT id INTO v_inventory_account_id FROM accounts WHERE account_code = '1020' LIMIT 1;
  SELECT id INTO v_adjustment_account_id FROM accounts WHERE account_code = '5020' LIMIT 1;

  -- Create adjustment account if it doesn't exist
  IF v_adjustment_account_id IS NULL THEN
    INSERT INTO accounts (
      account_code,
      account_name,
      account_type,
      description,
      created_by
    ) VALUES (
      '5020',
      'Inventory Adjustments',
      'expense',
      'Inventory losses, damages, and adjustments',
      auth.uid()
    ) RETURNING id INTO v_adjustment_account_id;
  END IF;

  -- Handle stock decrease (negative adjustment)
  IF NEW.adjustment_quantity < 0 THEN
    -- Use FIFO to deduct stock and get COGS
    SELECT json_agg(
      json_build_object(
        'layer_id', layer_id,
        'quantity_used', quantity_used,
        'unit_cost', unit_cost,
        'total_cogs', total_cogs
      )
    ), COALESCE(SUM(total_cogs), 0)
    INTO v_cogs_layers, v_total_cogs
    FROM deduct_stock_fifo(NEW.product_id, NEW.variant_id, ABS(NEW.adjustment_quantity));

    -- Update adjustment record with COGS
    NEW.cogs_amount := v_total_cogs;
    NEW.total_value := -v_total_cogs;

    -- Create journal entry for inventory decrease
    INSERT INTO journal_entries (
      description,
      entry_date,
      reference,
      total_debit,
      total_credit,
      status,
      created_by,
      posted_by,
      posted_at
    ) VALUES (
      'Stock Adjustment - Decrease: ' || NEW.reason,
      CURRENT_DATE,
      'ADJ-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', '') FROM 1 FOR 8)),
      v_total_cogs,
      v_total_cogs,
      'posted',
      NEW.adjusted_by,
      NEW.adjusted_by,
      NOW()
    ) RETURNING id INTO v_journal_entry_id;

    -- Debit: Inventory Adjustment (Expense)
    INSERT INTO journal_entry_lines (
      journal_entry_id,
      account_id,
      description,
      debit_amount,
      credit_amount
    ) VALUES (
      v_journal_entry_id,
      v_adjustment_account_id,
      'Inventory adjustment - ' || NEW.reason,
      v_total_cogs,
      0
    );

    -- Credit: Inventory (reduce asset)
    INSERT INTO journal_entry_lines (
      journal_entry_id,
      account_id,
      description,
      debit_amount,
      credit_amount
    ) VALUES (
      v_journal_entry_id,
      v_inventory_account_id,
      'Inventory reduction',
      0,
      v_total_cogs
    );

  -- Handle stock increase (positive adjustment)
  ELSIF NEW.adjustment_quantity > 0 THEN
    -- Create new inventory layer
    PERFORM create_adjustment_layer(
      NEW.product_id,
      NEW.variant_id,
      NEW.adjustment_quantity,
      COALESCE(NEW.unit_cost, 0),
      NEW.id
    );

    NEW.total_value := NEW.adjustment_quantity * COALESCE(NEW.unit_cost, 0);

    -- Create journal entry for inventory increase if cost > 0
    IF NEW.unit_cost > 0 THEN
      INSERT INTO journal_entries (
        description,
        entry_date,
        reference,
        total_debit,
        total_credit,
        status,
        created_by,
        posted_by,
        posted_at
      ) VALUES (
        'Stock Adjustment - Increase: ' || NEW.reason,
        CURRENT_DATE,
        'ADJ-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', '') FROM 1 FOR 8)),
        NEW.total_value,
        NEW.total_value,
        'posted',
        NEW.adjusted_by,
        NEW.adjusted_by,
        NOW()
      ) RETURNING id INTO v_journal_entry_id;

      -- Debit: Inventory (increase asset)
      INSERT INTO journal_entry_lines (
        journal_entry_id,
        account_id,
        description,
        debit_amount,
        credit_amount
      ) VALUES (
        v_journal_entry_id,
        v_inventory_account_id,
        'Inventory adjustment - ' || NEW.reason,
        NEW.total_value,
        0
      );

      -- Credit: Inventory Adjustment (reduces expense/gain)
      INSERT INTO journal_entry_lines (
        journal_entry_id,
        account_id,
        description,
        debit_amount,
        credit_amount
      ) VALUES (
        v_journal_entry_id,
        v_adjustment_account_id,
        'Inventory gain',
        0,
        NEW.total_value
      );
    END IF;
  END IF;

  -- Link journal entry to adjustment
  NEW.journal_entry_id := v_journal_entry_id;

  RETURN NEW;
END;
$$;

-- Create trigger for stock adjustments
DROP TRIGGER IF EXISTS trigger_handle_stock_adjustment ON stock_adjustments;
CREATE TRIGGER trigger_handle_stock_adjustment
  BEFORE INSERT ON stock_adjustments
  FOR EACH ROW
  EXECUTE FUNCTION handle_stock_adjustment();

-- Add helpful comment
COMMENT ON FUNCTION create_adjustment_layer IS 'Creates a new inventory layer for stock increases during adjustments';
COMMENT ON FUNCTION get_suggested_adjustment_cost IS 'Returns suggested costs (last purchase, weighted average, next FIFO) for adjustment';
COMMENT ON FUNCTION handle_stock_adjustment IS 'Handles FIFO layer management and accounting entries for stock adjustments';