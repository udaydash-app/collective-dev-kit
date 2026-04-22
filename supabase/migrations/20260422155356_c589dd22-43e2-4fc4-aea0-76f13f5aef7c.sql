CREATE OR REPLACE FUNCTION public.deduct_stock_simple()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  item jsonb;
  stock_item jsonb;
BEGIN
  -- Handle INSERT: deduct stock for all new items, expanding combo/one-time-offer contents
  IF TG_OP = 'INSERT' THEN
    RAISE NOTICE 'DEDUCT TRIGGER FIRED (INSERT) for transaction %', NEW.transaction_number;

    FOR item IN SELECT * FROM jsonb_array_elements(NEW.items)
    LOOP
      FOR stock_item IN
        SELECT value FROM jsonb_array_elements(
          CASE
            WHEN jsonb_typeof(item->'comboItems') = 'array' AND jsonb_array_length(item->'comboItems') > 0 THEN item->'comboItems'
            ELSE jsonb_build_array(item)
          END
        )
      LOOP
        IF COALESCE(stock_item->>'productId', stock_item->>'product_id') IS NULL
           OR COALESCE(stock_item->>'productId', stock_item->>'product_id') = 'cart-discount' THEN
          CONTINUE;
        END IF;

        IF COALESCE(stock_item->>'variantId', stock_item->>'variant_id') IS NOT NULL
           AND COALESCE(stock_item->>'variantId', stock_item->>'variant_id') != '' THEN
          UPDATE product_variants
          SET stock_quantity = COALESCE(stock_quantity, 0) - COALESCE((stock_item->>'quantity')::numeric, 0),
              updated_at = now()
          WHERE id = COALESCE(stock_item->>'variantId', stock_item->>'variant_id')::uuid;
        ELSE
          UPDATE products
          SET stock_quantity = COALESCE(stock_quantity, 0) - COALESCE((stock_item->>'quantity')::numeric, 0),
              updated_at = now()
          WHERE id = COALESCE(stock_item->>'productId', stock_item->>'product_id')::uuid;
        END IF;
      END LOOP;
    END LOOP;

  -- Handle UPDATE: restore OLD expanded items stock, deduct NEW expanded items stock
  ELSIF TG_OP = 'UPDATE' THEN
    RAISE NOTICE 'DEDUCT TRIGGER FIRED (UPDATE) for transaction %', NEW.transaction_number;

    FOR item IN SELECT * FROM jsonb_array_elements(OLD.items)
    LOOP
      FOR stock_item IN
        SELECT value FROM jsonb_array_elements(
          CASE
            WHEN jsonb_typeof(item->'comboItems') = 'array' AND jsonb_array_length(item->'comboItems') > 0 THEN item->'comboItems'
            ELSE jsonb_build_array(item)
          END
        )
      LOOP
        IF COALESCE(stock_item->>'productId', stock_item->>'product_id') IS NULL
           OR COALESCE(stock_item->>'productId', stock_item->>'product_id') = 'cart-discount' THEN
          CONTINUE;
        END IF;

        IF COALESCE(stock_item->>'variantId', stock_item->>'variant_id') IS NOT NULL
           AND COALESCE(stock_item->>'variantId', stock_item->>'variant_id') != '' THEN
          UPDATE product_variants
          SET stock_quantity = COALESCE(stock_quantity, 0) + COALESCE((stock_item->>'quantity')::numeric, 0),
              updated_at = now()
          WHERE id = COALESCE(stock_item->>'variantId', stock_item->>'variant_id')::uuid;
        ELSE
          UPDATE products
          SET stock_quantity = COALESCE(stock_quantity, 0) + COALESCE((stock_item->>'quantity')::numeric, 0),
              updated_at = now()
          WHERE id = COALESCE(stock_item->>'productId', stock_item->>'product_id')::uuid;
        END IF;
      END LOOP;
    END LOOP;

    FOR item IN SELECT * FROM jsonb_array_elements(NEW.items)
    LOOP
      FOR stock_item IN
        SELECT value FROM jsonb_array_elements(
          CASE
            WHEN jsonb_typeof(item->'comboItems') = 'array' AND jsonb_array_length(item->'comboItems') > 0 THEN item->'comboItems'
            ELSE jsonb_build_array(item)
          END
        )
      LOOP
        IF COALESCE(stock_item->>'productId', stock_item->>'product_id') IS NULL
           OR COALESCE(stock_item->>'productId', stock_item->>'product_id') = 'cart-discount' THEN
          CONTINUE;
        END IF;

        IF COALESCE(stock_item->>'variantId', stock_item->>'variant_id') IS NOT NULL
           AND COALESCE(stock_item->>'variantId', stock_item->>'variant_id') != '' THEN
          UPDATE product_variants
          SET stock_quantity = COALESCE(stock_quantity, 0) - COALESCE((stock_item->>'quantity')::numeric, 0),
              updated_at = now()
          WHERE id = COALESCE(stock_item->>'variantId', stock_item->>'variant_id')::uuid;
        ELSE
          UPDATE products
          SET stock_quantity = COALESCE(stock_quantity, 0) - COALESCE((stock_item->>'quantity')::numeric, 0),
              updated_at = now()
          WHERE id = COALESCE(stock_item->>'productId', stock_item->>'product_id')::uuid;
        END IF;
      END LOOP;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$;