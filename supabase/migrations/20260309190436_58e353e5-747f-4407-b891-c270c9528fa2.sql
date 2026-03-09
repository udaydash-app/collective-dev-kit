-- Fix: Update deduct_stock_simple to also handle UPDATE events
-- When a POS transaction is updated (e.g., edited bill), we need to:
-- 1. Restore stock for the OLD items
-- 2. Deduct stock for the NEW items

CREATE OR REPLACE FUNCTION public.deduct_stock_simple()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item jsonb;
BEGIN
  -- Handle INSERT: just deduct stock for all new items
  IF TG_OP = 'INSERT' THEN
    RAISE NOTICE 'DEDUCT TRIGGER FIRED (INSERT) for transaction %', NEW.transaction_number;
    
    FOR item IN SELECT * FROM jsonb_array_elements(NEW.items)
    LOOP
      -- Skip non-product items (e.g., cart-discount)
      IF item->>'productId' IS NULL OR item->>'productId' = 'cart-discount' THEN
        CONTINUE;
      END IF;

      IF item->>'variantId' IS NOT NULL AND item->>'variantId' != '' THEN
        UPDATE product_variants
        SET stock_quantity = stock_quantity - (item->>'quantity')::numeric,
            updated_at = now()
        WHERE id = (item->>'variantId')::uuid;
      ELSE
        UPDATE products
        SET stock_quantity = stock_quantity - (item->>'quantity')::numeric,
            updated_at = now()
        WHERE id = (item->>'productId')::uuid;
      END IF;
    END LOOP;

  -- Handle UPDATE: restore OLD items stock, deduct NEW items stock
  ELSIF TG_OP = 'UPDATE' THEN
    RAISE NOTICE 'DEDUCT TRIGGER FIRED (UPDATE) for transaction %', NEW.transaction_number;

    -- Step 1: Restore stock for OLD items
    FOR item IN SELECT * FROM jsonb_array_elements(OLD.items)
    LOOP
      IF item->>'productId' IS NULL OR item->>'productId' = 'cart-discount' THEN
        CONTINUE;
      END IF;

      IF item->>'variantId' IS NOT NULL AND item->>'variantId' != '' THEN
        UPDATE product_variants
        SET stock_quantity = stock_quantity + (item->>'quantity')::numeric,
            updated_at = now()
        WHERE id = (item->>'variantId')::uuid;
      ELSE
        UPDATE products
        SET stock_quantity = stock_quantity + (item->>'quantity')::numeric,
            updated_at = now()
        WHERE id = (item->>'productId')::uuid;
      END IF;
    END LOOP;

    -- Step 2: Deduct stock for NEW items
    FOR item IN SELECT * FROM jsonb_array_elements(NEW.items)
    LOOP
      IF item->>'productId' IS NULL OR item->>'productId' = 'cart-discount' THEN
        CONTINUE;
      END IF;

      IF item->>'variantId' IS NOT NULL AND item->>'variantId' != '' THEN
        UPDATE product_variants
        SET stock_quantity = stock_quantity - (item->>'quantity')::numeric,
            updated_at = now()
        WHERE id = (item->>'variantId')::uuid;
      ELSE
        UPDATE products
        SET stock_quantity = stock_quantity - (item->>'quantity')::numeric,
            updated_at = now()
        WHERE id = (item->>'productId')::uuid;
      END IF;
    END LOOP;

  END IF;

  RETURN NEW;
END;
$$;

-- Drop and recreate the trigger to also fire on UPDATE OF items column
DROP TRIGGER IF EXISTS deduct_stock_trigger ON public.pos_transactions;

CREATE TRIGGER deduct_stock_trigger
AFTER INSERT OR UPDATE OF items
ON public.pos_transactions
FOR EACH ROW
EXECUTE FUNCTION public.deduct_stock_simple();

-- Ensure restore trigger fires AFTER DELETE (not BEFORE)
DROP TRIGGER IF EXISTS restore_stock_on_delete_trigger ON public.pos_transactions;

CREATE TRIGGER restore_stock_on_delete_trigger
AFTER DELETE
ON public.pos_transactions
FOR EACH ROW
EXECUTE FUNCTION public.restore_stock_on_transaction_delete();