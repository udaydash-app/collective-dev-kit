-- Add purchase_id to supplier_payments to link payments to specific purchases
ALTER TABLE supplier_payments
ADD COLUMN purchase_id uuid REFERENCES purchases(id) ON DELETE SET NULL;

-- Add index for faster queries
CREATE INDEX idx_supplier_payments_purchase_id ON supplier_payments(purchase_id);

-- Add a column to track total amount paid on each purchase
ALTER TABLE purchases
ADD COLUMN amount_paid numeric DEFAULT 0;

-- Add a column to track payment details array
ALTER TABLE purchases
ALTER COLUMN payment_details TYPE jsonb USING payment_details::jsonb;

-- Update amount_paid for existing purchases based on payment_status
UPDATE purchases
SET amount_paid = CASE
  WHEN payment_status = 'paid' THEN total_amount
  WHEN payment_status = 'partial' THEN total_amount * 0.5  -- We'll need to update this with actual payments
  ELSE 0
END;

-- Create a trigger function to update purchase payment status when supplier payment is made
CREATE OR REPLACE FUNCTION update_purchase_payment_status()
RETURNS TRIGGER AS $$
DECLARE
  purchase_total numeric;
  total_paid numeric;
BEGIN
  -- Only process if purchase_id is set
  IF NEW.purchase_id IS NOT NULL THEN
    -- Get the total amount of the purchase
    SELECT total_amount INTO purchase_total
    FROM purchases
    WHERE id = NEW.purchase_id;
    
    -- Calculate total paid for this purchase
    SELECT COALESCE(SUM(amount), 0) INTO total_paid
    FROM supplier_payments
    WHERE purchase_id = NEW.purchase_id;
    
    -- Update purchase payment status and amount_paid
    UPDATE purchases
    SET 
      amount_paid = total_paid,
      payment_status = CASE
        WHEN total_paid >= purchase_total THEN 'paid'
        WHEN total_paid > 0 THEN 'partial'
        ELSE 'pending'
      END,
      updated_at = now()
    WHERE id = NEW.purchase_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for INSERT
CREATE TRIGGER trigger_update_purchase_payment_status_insert
AFTER INSERT ON supplier_payments
FOR EACH ROW
EXECUTE FUNCTION update_purchase_payment_status();

-- Create trigger for UPDATE
CREATE TRIGGER trigger_update_purchase_payment_status_update
AFTER UPDATE ON supplier_payments
FOR EACH ROW
WHEN (OLD.purchase_id IS DISTINCT FROM NEW.purchase_id OR OLD.amount IS DISTINCT FROM NEW.amount)
EXECUTE FUNCTION update_purchase_payment_status();

-- Create trigger for DELETE
CREATE OR REPLACE FUNCTION update_purchase_payment_status_on_delete()
RETURNS TRIGGER AS $$
DECLARE
  purchase_total numeric;
  total_paid numeric;
BEGIN
  -- Only process if purchase_id was set
  IF OLD.purchase_id IS NOT NULL THEN
    -- Get the total amount of the purchase
    SELECT total_amount INTO purchase_total
    FROM purchases
    WHERE id = OLD.purchase_id;
    
    -- Calculate total paid for this purchase (excluding the deleted payment)
    SELECT COALESCE(SUM(amount), 0) INTO total_paid
    FROM supplier_payments
    WHERE purchase_id = OLD.purchase_id;
    
    -- Update purchase payment status and amount_paid
    UPDATE purchases
    SET 
      amount_paid = total_paid,
      payment_status = CASE
        WHEN total_paid >= purchase_total THEN 'paid'
        WHEN total_paid > 0 THEN 'partial'
        ELSE 'pending'
      END,
      updated_at = now()
    WHERE id = OLD.purchase_id;
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_purchase_payment_status_delete
AFTER DELETE ON supplier_payments
FOR EACH ROW
EXECUTE FUNCTION update_purchase_payment_status_on_delete();