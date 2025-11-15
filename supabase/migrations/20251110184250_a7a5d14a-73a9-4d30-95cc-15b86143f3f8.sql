-- Function to help match and link supplier payments to purchases
-- This will attempt to link unlinked supplier payments to matching purchases

DO $$
DECLARE
  payment_record RECORD;
  matching_purchase_id UUID;
  supplier_contact RECORD;
BEGIN
  -- Loop through all unlinked supplier payments
  FOR payment_record IN 
    SELECT sp.*, c.name as supplier_name
    FROM supplier_payments sp
    JOIN contacts c ON c.id = sp.contact_id
    WHERE sp.purchase_id IS NULL
    ORDER BY sp.payment_date
  LOOP
    -- Try to find a matching purchase:
    -- 1. Same supplier name
    -- 2. Total amount matches payment amount (indicating full payment)
    -- 3. Purchase date is before or on payment date
    -- 4. Purchase is pending or partial
    -- 5. No other payment already linked to this purchase
    SELECT p.id INTO matching_purchase_id
    FROM purchases p
    WHERE p.supplier_name = payment_record.supplier_name
      AND p.total_amount = payment_record.amount
      AND p.purchased_at <= payment_record.payment_date
      AND p.payment_status IN ('pending', 'partial')
      AND NOT EXISTS (
        SELECT 1 FROM supplier_payments sp2 
        WHERE sp2.purchase_id = p.id
      )
    ORDER BY p.purchased_at DESC
    LIMIT 1;
    
    -- If we found a match, link the payment
    IF matching_purchase_id IS NOT NULL THEN
      UPDATE supplier_payments
      SET purchase_id = matching_purchase_id
      WHERE id = payment_record.id;
      
      RAISE NOTICE 'Linked payment % to purchase %', 
        payment_record.payment_number, matching_purchase_id;
    END IF;
  END LOOP;
END $$;

-- The triggers will automatically update the purchase statuses
-- after the purchase_id is set on the supplier_payments