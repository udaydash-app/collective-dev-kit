
CREATE OR REPLACE FUNCTION public.apply_damage_stock_adjustment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_damage_acct uuid;
  v_inventory_acct uuid;
  v_entry_id uuid;
  v_amount numeric;
  v_ref text;
BEGIN
  IF NEW.adjustment_type IS DISTINCT FROM 'damage' THEN
    RETURN NEW;
  END IF;

  -- 1. Deduct stock (quantity_change is negative for damage)
  IF NEW.variant_id IS NOT NULL THEN
    UPDATE public.product_variants
      SET stock_quantity = COALESCE(stock_quantity, 0) + NEW.quantity_change
      WHERE id = NEW.variant_id;
  ELSE
    UPDATE public.products
      SET stock_quantity = COALESCE(stock_quantity, 0) + NEW.quantity_change
      WHERE id = NEW.product_id;
  END IF;

  -- 2. Journal entry Dr 6585 Damage / Cr 31 Inventory at cost
  v_amount := ROUND(ABS(COALESCE(NEW.quantity_change, 0)) * COALESCE(NEW.unit_cost, 0), 2);
  IF v_amount > 0 THEN
    SELECT id INTO v_damage_acct FROM public.accounts WHERE account_code = '6585' LIMIT 1;
    SELECT id INTO v_inventory_acct FROM public.accounts WHERE account_code = '31' LIMIT 1;

    IF v_damage_acct IS NOT NULL AND v_inventory_acct IS NOT NULL THEN
      v_ref := 'DMG-' || upper(substr(replace(NEW.id::text, '-', ''), 1, 10));
      INSERT INTO public.journal_entries (
        entry_number, entry_date, reference, description, status,
        total_debit, total_credit, posted_at, created_by
      ) VALUES (
        v_ref, COALESCE(NEW.created_at::date, CURRENT_DATE), v_ref,
        'Damage write-off' || COALESCE(' - ' || NEW.reason, ''),
        'posted', v_amount, v_amount, now(), NEW.adjusted_by
      ) RETURNING id INTO v_entry_id;

      INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
      VALUES
        (v_entry_id, v_damage_acct, 'Damage write-off', v_amount, 0),
        (v_entry_id, v_inventory_acct, 'Inventory reduction (damage)', 0, v_amount);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_damage_stock_adjustment ON public.stock_adjustments;
CREATE TRIGGER trg_apply_damage_stock_adjustment
AFTER INSERT ON public.stock_adjustments
FOR EACH ROW EXECUTE FUNCTION public.apply_damage_stock_adjustment();

CREATE OR REPLACE FUNCTION public.reverse_damage_stock_adjustment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref text;
  v_entry_id uuid;
BEGIN
  IF OLD.adjustment_type IS DISTINCT FROM 'damage' THEN
    RETURN OLD;
  END IF;

  IF OLD.variant_id IS NOT NULL THEN
    UPDATE public.product_variants
      SET stock_quantity = COALESCE(stock_quantity, 0) - OLD.quantity_change
      WHERE id = OLD.variant_id;
  ELSE
    UPDATE public.products
      SET stock_quantity = COALESCE(stock_quantity, 0) - OLD.quantity_change
      WHERE id = OLD.product_id;
  END IF;

  v_ref := 'DMG-' || upper(substr(replace(OLD.id::text, '-', ''), 1, 10));
  SELECT id INTO v_entry_id FROM public.journal_entries WHERE entry_number = v_ref LIMIT 1;
  IF v_entry_id IS NOT NULL THEN
    DELETE FROM public.journal_entry_lines WHERE journal_entry_id = v_entry_id;
    DELETE FROM public.journal_entries WHERE id = v_entry_id;
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_reverse_damage_stock_adjustment ON public.stock_adjustments;
CREATE TRIGGER trg_reverse_damage_stock_adjustment
AFTER DELETE ON public.stock_adjustments
FOR EACH ROW EXECUTE FUNCTION public.reverse_damage_stock_adjustment();
