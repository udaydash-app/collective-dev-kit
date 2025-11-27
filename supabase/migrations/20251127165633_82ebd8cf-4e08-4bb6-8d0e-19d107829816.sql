-- Allow negative stock values
CREATE OR REPLACE FUNCTION public.deduct_stock_simple()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  item jsonb;
  product_rec record;
BEGIN
  -- Loop through all items in the transaction
  FOR item IN SELECT * FROM jsonb_array_elements(NEW.items)
  LOOP
    -- Get product details
    SELECT id, stock_quantity INTO product_rec
    FROM products
    WHERE id = (item->>'productId')::uuid;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    -- Deduct stock from product or variant (allow negative values)
    IF item->>'variantId' IS NOT NULL AND item->>'variantId' != '' THEN
      -- Update variant stock (allow negative)
      UPDATE product_variants
      SET stock_quantity = stock_quantity - (item->>'quantity')::numeric
      WHERE id = (item->>'variantId')::uuid;
    ELSE
      -- Update product stock (allow negative)
      UPDATE products
      SET stock_quantity = stock_quantity - (item->>'quantity')::numeric
      WHERE id = (item->>'productId')::uuid;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;