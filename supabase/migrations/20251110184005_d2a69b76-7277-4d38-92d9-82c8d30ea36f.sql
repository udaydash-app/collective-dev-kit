-- Drop existing triggers and functions
DROP TRIGGER IF EXISTS trigger_update_purchase_payment_status_insert ON supplier_payments;
DROP TRIGGER IF EXISTS trigger_update_purchase_payment_status_update ON supplier_payments;
DROP TRIGGER IF EXISTS trigger_update_purchase_payment_status_delete ON supplier_payments;
DROP FUNCTION IF EXISTS update_purchase_payment_status();
DROP FUNCTION IF EXISTS update_purchase_payment_status_on_delete();

-- Create improved function to update purchase payment status with payment details
CREATE OR REPLACE FUNCTION update_purchase_payment_status()
RETURNS TRIGGER AS $$
DECLARE
  purchase_total numeric;
  total_paid numeric;
  payment_methods jsonb;
  unique_methods text[];
  payment_method_display text;
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
    
    -- Get payment details array (method and amount for each payment)
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'method', payment_method,
          'amount', amount
        ) ORDER BY payment_date
      ),
      '[]'::jsonb
    ) INTO payment_methods
    FROM supplier_payments
    WHERE purchase_id = NEW.purchase_id;
    
    -- Get unique payment methods for display
    SELECT array_agg(DISTINCT payment_method ORDER BY payment_method)
    INTO unique_methods
    FROM supplier_payments
    WHERE purchase_id = NEW.purchase_id;
    
    -- Determine payment method display text
    IF array_length(unique_methods, 1) IS NULL THEN
      payment_method_display := NULL;
    ELSIF array_length(unique_methods, 1) = 1 THEN
      payment_method_display := unique_methods[1];
    ELSE
      payment_method_display := 'Multiple';
    END IF;
    
    -- Update purchase payment status, amount_paid, payment_method, and payment_details
    UPDATE purchases
    SET 
      amount_paid = total_paid,
      payment_status = CASE
        WHEN total_paid >= purchase_total THEN 'paid'
        WHEN total_paid > 0 THEN 'partial'
        ELSE 'pending'
      END,
      payment_method = COALESCE(payment_method_display, payment_method),
      payment_details = payment_methods,
      updated_at = now()
    WHERE id = NEW.purchase_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create function for DELETE operations
CREATE OR REPLACE FUNCTION update_purchase_payment_status_on_delete()
RETURNS TRIGGER AS $$
DECLARE
  purchase_total numeric;
  total_paid numeric;
  payment_methods jsonb;
  unique_methods text[];
  payment_method_display text;
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
    
    -- Get payment details array (excluding deleted payment)
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'method', payment_method,
          'amount', amount
        ) ORDER BY payment_date
      ),
      '[]'::jsonb
    ) INTO payment_methods
    FROM supplier_payments
    WHERE purchase_id = OLD.purchase_id;
    
    -- Get unique payment methods for display
    SELECT array_agg(DISTINCT payment_method ORDER BY payment_method)
    INTO unique_methods
    FROM supplier_payments
    WHERE purchase_id = OLD.purchase_id;
    
    -- Determine payment method display text
    IF array_length(unique_methods, 1) IS NULL THEN
      -- No payments left, get original payment method from purchase
      SELECT payment_method INTO payment_method_display
      FROM purchases
      WHERE id = OLD.purchase_id;
    ELSIF array_length(unique_methods, 1) = 1 THEN
      payment_method_display := unique_methods[1];
    ELSE
      payment_method_display := 'Multiple';
    END IF;
    
    -- Update purchase payment status, amount_paid, payment_method, and payment_details
    UPDATE purchases
    SET 
      amount_paid = total_paid,
      payment_status = CASE
        WHEN total_paid >= purchase_total THEN 'paid'
        WHEN total_paid > 0 THEN 'partial'
        ELSE 'pending'
      END,
      payment_method = payment_method_display,
      payment_details = payment_methods,
      updated_at = now()
    WHERE id = OLD.purchase_id;
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Recreate triggers
CREATE TRIGGER trigger_update_purchase_payment_status_insert
AFTER INSERT ON supplier_payments
FOR EACH ROW
EXECUTE FUNCTION update_purchase_payment_status();

CREATE TRIGGER trigger_update_purchase_payment_status_update
AFTER UPDATE ON supplier_payments
FOR EACH ROW
WHEN (OLD.purchase_id IS DISTINCT FROM NEW.purchase_id OR OLD.amount IS DISTINCT FROM NEW.amount OR OLD.payment_method IS DISTINCT FROM NEW.payment_method)
EXECUTE FUNCTION update_purchase_payment_status();

CREATE TRIGGER trigger_update_purchase_payment_status_delete
AFTER DELETE ON supplier_payments
FOR EACH ROW
EXECUTE FUNCTION update_purchase_payment_status_on_delete();