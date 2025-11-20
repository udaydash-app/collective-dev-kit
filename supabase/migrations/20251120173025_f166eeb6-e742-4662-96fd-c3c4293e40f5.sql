-- Add supplier tracking to products table
ALTER TABLE products ADD COLUMN supplier_id uuid REFERENCES contacts(id);

-- Create index for better performance
CREATE INDEX idx_products_supplier_id ON products(supplier_id);

-- Update existing products with their most recent supplier from purchase history
UPDATE products p
SET supplier_id = (
  SELECT c.id
  FROM purchase_items pi
  JOIN purchases pur ON pur.id = pi.purchase_id
  JOIN contacts c ON c.name = pur.supplier_name AND c.is_supplier = true
  WHERE pi.product_id = p.id
  ORDER BY pur.purchased_at DESC
  LIMIT 1
)
WHERE EXISTS (
  SELECT 1
  FROM purchase_items pi
  JOIN purchases pur ON pur.id = pi.purchase_id
  WHERE pi.product_id = p.id
);

-- Create trigger function to update product supplier when purchased
CREATE OR REPLACE FUNCTION update_product_supplier()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_supplier_id uuid;
BEGIN
  -- Get supplier ID from the purchase
  SELECT c.id INTO v_supplier_id
  FROM purchases p
  JOIN contacts c ON c.name = p.supplier_name AND c.is_supplier = true
  WHERE p.id = NEW.purchase_id;
  
  -- Update the product's supplier
  IF v_supplier_id IS NOT NULL THEN
    UPDATE products
    SET supplier_id = v_supplier_id,
        updated_at = NOW()
    WHERE id = NEW.product_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to update product supplier on purchase
CREATE TRIGGER update_product_supplier_on_purchase
AFTER INSERT ON purchase_items
FOR EACH ROW
EXECUTE FUNCTION update_product_supplier();