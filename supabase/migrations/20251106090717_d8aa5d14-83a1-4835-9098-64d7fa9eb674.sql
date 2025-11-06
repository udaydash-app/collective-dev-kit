-- Stock Reconciliation: Reset and Recalculate from 1/11/2025
-- Step 1: Reset all stock to zero
UPDATE products SET stock_quantity = 0;
UPDATE product_variants SET stock_quantity = 0;

-- Step 2: Add stock from purchases (from 1/11/2025 onwards)
-- Update products without variants
UPDATE products p
SET stock_quantity = COALESCE((
  SELECT SUM(pi.quantity)
  FROM purchase_items pi
  JOIN purchases pu ON pu.id = pi.purchase_id
  WHERE pi.product_id = p.id
    AND pi.variant_id IS NULL
    AND pu.purchased_at >= '2025-11-01'
), 0);

-- Update product variants
UPDATE product_variants pv
SET stock_quantity = COALESCE((
  SELECT SUM(pi.quantity)
  FROM purchase_items pi
  JOIN purchases pu ON pu.id = pi.purchase_id
  WHERE pi.variant_id = pv.id
    AND pu.purchased_at >= '2025-11-01'
), 0);

-- Step 3: Deduct stock from POS sales (from 1/11/2025 onwards)
-- Deduct from products without variants
UPDATE products p
SET stock_quantity = GREATEST(0, stock_quantity - COALESCE((
  SELECT SUM((item->>'quantity')::numeric)
  FROM pos_transactions pt,
       jsonb_array_elements(pt.items) AS item
  WHERE (item->>'product_id')::uuid = p.id
    AND (item->>'variant_id') IS NULL
    AND pt.created_at >= '2025-11-01'
), 0));

-- Deduct from product variants
UPDATE product_variants pv
SET stock_quantity = GREATEST(0, stock_quantity - COALESCE((
  SELECT SUM((item->>'quantity')::numeric)
  FROM pos_transactions pt,
       jsonb_array_elements(pt.items) AS item
  WHERE (item->>'variant_id')::uuid = pv.id
    AND pt.created_at >= '2025-11-01'
), 0));

-- Step 4: Apply stock adjustments (from 1/11/2025 onwards)
-- Apply adjustments to products without variants
UPDATE products p
SET stock_quantity = GREATEST(0, stock_quantity + COALESCE((
  SELECT SUM(sa.quantity_change)
  FROM stock_adjustments sa
  WHERE sa.product_id = p.id
    AND sa.variant_id IS NULL
    AND sa.created_at >= '2025-11-01'
), 0));

-- Apply adjustments to product variants
UPDATE product_variants pv
SET stock_quantity = GREATEST(0, stock_quantity + COALESCE((
  SELECT SUM(sa.quantity_change)
  FROM stock_adjustments sa
  WHERE sa.variant_id = pv.id
    AND sa.created_at >= '2025-11-01'
), 0));