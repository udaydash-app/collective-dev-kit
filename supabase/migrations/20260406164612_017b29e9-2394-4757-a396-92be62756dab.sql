
CREATE OR REPLACE FUNCTION public.sync_product_local_charges()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update the product's local_charges with the value from the purchase item
  UPDATE products
  SET local_charges = NEW.local_charges,
      updated_at = now()
  WHERE id = NEW.product_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_sync_product_local_charges ON purchase_items;
CREATE TRIGGER trigger_sync_product_local_charges
  AFTER INSERT OR UPDATE ON purchase_items
  FOR EACH ROW
  WHEN (NEW.local_charges IS NOT NULL AND NEW.local_charges > 0)
  EXECUTE FUNCTION sync_product_local_charges();
