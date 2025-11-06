
-- Drop all triggers and functions related to stock adjustments
DROP TRIGGER IF EXISTS trigger_handle_stock_adjustment ON stock_adjustments;
DROP TRIGGER IF EXISTS stock_adjustment_trigger ON stock_adjustments;
DROP FUNCTION IF EXISTS handle_stock_adjustment() CASCADE;

-- Now update the stock without any triggers
UPDATE product_variants 
SET stock_quantity = 453
WHERE id = '84d700d3-29d5-42c4-9717-5998cbf198c4';

-- Create stock adjustment record for audit trail
INSERT INTO stock_adjustments (
  product_id,
  variant_id,
  store_id,
  adjustment_type,
  quantity_change,
  unit_cost,
  cost_source,
  reason,
  adjusted_by,
  total_value,
  cogs_amount
) VALUES (
  'f71d3b5a-9699-4b2a-ada4-12cc2bb8519e',
  '84d700d3-29d5-42c4-9717-5998cbf198c4',
  '086e4c9f-c660-41fc-ab94-552393c13be8',
  'manual',
  453,
  0,
  'system',
  'Physical stock count - reconciliation',
  '43fb7354-cdeb-48a6-8f45-3602a0bc6005',
  0,
  0
);
