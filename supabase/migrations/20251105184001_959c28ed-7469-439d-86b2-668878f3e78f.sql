-- Phase 1: Create inventory_layers table for FIFO tracking
CREATE TABLE IF NOT EXISTS public.inventory_layers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES public.product_variants(id) ON DELETE CASCADE,
  purchase_id UUID REFERENCES public.purchases(id) ON DELETE SET NULL,
  purchase_item_id UUID REFERENCES public.purchase_items(id) ON DELETE SET NULL,
  quantity_purchased NUMERIC NOT NULL CHECK (quantity_purchased > 0),
  quantity_remaining NUMERIC NOT NULL CHECK (quantity_remaining >= 0),
  unit_cost NUMERIC NOT NULL CHECK (unit_cost >= 0),
  purchased_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_remaining_qty CHECK (quantity_remaining <= quantity_purchased)
);

-- Create indexes for FIFO performance
CREATE INDEX IF NOT EXISTS idx_inventory_layers_fifo 
  ON public.inventory_layers(product_id, purchased_at ASC) 
  WHERE quantity_remaining > 0 AND variant_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_layers_fifo_variant 
  ON public.inventory_layers(variant_id, purchased_at ASC) 
  WHERE quantity_remaining > 0 AND variant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_layers_product 
  ON public.inventory_layers(product_id);

-- Enable RLS
ALTER TABLE public.inventory_layers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for inventory_layers
CREATE POLICY "Admins can view all inventory layers"
  ON public.inventory_layers FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert inventory layers"
  ON public.inventory_layers FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update inventory layers"
  ON public.inventory_layers FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete inventory layers"
  ON public.inventory_layers FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Cashiers can view inventory layers"
  ON public.inventory_layers FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'cashier'::app_role));

CREATE POLICY "Cashiers can insert inventory layers"
  ON public.inventory_layers FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'cashier'::app_role));

CREATE POLICY "Cashiers can update inventory layers"
  ON public.inventory_layers FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'cashier'::app_role));

-- Phase 2: Update update_stock_on_purchase trigger to create inventory layers
CREATE OR REPLACE FUNCTION public.update_stock_on_purchase()
RETURNS TRIGGER AS $$
BEGIN
  -- Update product stock if no variant
  IF NEW.variant_id IS NULL THEN
    UPDATE products
    SET stock_quantity = stock_quantity + NEW.quantity,
        cost_price = NEW.unit_price,
        updated_at = NOW()
    WHERE id = NEW.product_id;
    
    -- Create inventory layer for FIFO
    INSERT INTO inventory_layers (
      product_id,
      variant_id,
      purchase_id,
      purchase_item_id,
      quantity_purchased,
      quantity_remaining,
      unit_cost,
      purchased_at
    ) VALUES (
      NEW.product_id,
      NULL,
      NEW.purchase_id,
      NEW.id,
      NEW.quantity,
      NEW.quantity,
      NEW.unit_price,
      NOW()
    );
  ELSE
    -- Update variant stock
    UPDATE product_variants
    SET stock_quantity = stock_quantity + NEW.quantity,
        updated_at = NOW()
    WHERE id = NEW.variant_id;
    
    -- Create inventory layer for variant
    INSERT INTO inventory_layers (
      product_id,
      variant_id,
      purchase_id,
      purchase_item_id,
      quantity_purchased,
      quantity_remaining,
      unit_cost,
      purchased_at
    ) VALUES (
      NEW.product_id,
      NEW.variant_id,
      NEW.purchase_id,
      NEW.id,
      NEW.quantity,
      NEW.quantity,
      NEW.unit_price,
      NOW()
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Phase 3: Create FIFO deduction function
CREATE OR REPLACE FUNCTION public.deduct_stock_fifo(
  p_product_id UUID,
  p_variant_id UUID,
  p_quantity NUMERIC
) RETURNS TABLE (
  layer_id UUID,
  quantity_used NUMERIC,
  unit_cost NUMERIC,
  total_cogs NUMERIC
) AS $$
DECLARE
  v_remaining_qty NUMERIC := p_quantity;
  v_layer RECORD;
  v_qty_to_deduct NUMERIC;
BEGIN
  -- Get layers in FIFO order (oldest first)
  FOR v_layer IN 
    SELECT id, quantity_remaining, unit_cost
    FROM inventory_layers
    WHERE product_id = p_product_id
      AND (p_variant_id IS NULL AND variant_id IS NULL OR variant_id = p_variant_id)
      AND quantity_remaining > 0
    ORDER BY purchased_at ASC, created_at ASC
    FOR UPDATE
  LOOP
    -- Calculate how much to deduct from this layer
    v_qty_to_deduct := LEAST(v_layer.quantity_remaining, v_remaining_qty);
    
    -- Return this layer's COGS contribution
    layer_id := v_layer.id;
    quantity_used := v_qty_to_deduct;
    unit_cost := v_layer.unit_cost;
    total_cogs := v_qty_to_deduct * v_layer.unit_cost;
    RETURN NEXT;
    
    -- Update the layer
    UPDATE inventory_layers
    SET quantity_remaining = quantity_remaining - v_qty_to_deduct,
        updated_at = NOW()
    WHERE id = v_layer.id;
    
    -- Reduce remaining quantity needed
    v_remaining_qty := v_remaining_qty - v_qty_to_deduct;
    
    -- Exit if we've deducted enough
    EXIT WHEN v_remaining_qty <= 0;
  END LOOP;
  
  -- Check if we couldn't deduct the full quantity
  IF v_remaining_qty > 0 THEN
    RAISE EXCEPTION 'Insufficient inventory layers for product %. Short by % units.', 
      p_product_id, v_remaining_qty;
  END IF;
  
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Phase 4: Create COGS account if it doesn't exist
DO $$
DECLARE
  v_cogs_account_id UUID;
  v_expense_parent_id UUID;
BEGIN
  -- Check if COGS account exists
  SELECT id INTO v_cogs_account_id FROM accounts WHERE account_code = '5010' LIMIT 1;
  
  IF v_cogs_account_id IS NULL THEN
    -- Get expense parent account
    SELECT id INTO v_expense_parent_id FROM accounts WHERE account_code = '5000' LIMIT 1;
    
    -- Create COGS account
    INSERT INTO accounts (
      account_code,
      account_name,
      account_type,
      parent_account_id,
      description,
      is_active
    ) VALUES (
      '5010',
      'Cost of Goods Sold',
      'expense',
      v_expense_parent_id,
      'Cost of inventory sold during the period',
      true
    );
  END IF;
END $$;

-- Phase 5: Update handle_pos_journal_entry to include COGS
CREATE OR REPLACE FUNCTION public.handle_pos_journal_entry()
RETURNS TRIGGER AS $$
DECLARE
  v_cash_account_id UUID;
  v_mobile_money_account_id UUID;
  v_sales_account_id UUID;
  v_discount_account_id UUID;
  v_tax_account_id UUID;
  v_ar_account_id UUID;
  v_cogs_account_id UUID;
  v_inventory_account_id UUID;
  v_customer_ledger_id UUID;
  v_journal_entry_id UUID;
  v_payment_account_id UUID;
  v_existing_entry_count INTEGER;
  v_total_cogs NUMERIC := 0;
BEGIN
  -- Handle DELETE
  IF TG_OP = 'DELETE' THEN
    DELETE FROM journal_entries 
    WHERE reference = OLD.transaction_number 
      AND description = 'POS Sale - ' || OLD.transaction_number;
    RETURN OLD;
  END IF;

  -- Handle UPDATE
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM journal_entries 
    WHERE reference = OLD.transaction_number 
      AND description = 'POS Sale - ' || OLD.transaction_number;
  END IF;

  -- Check if journal entry already exists
  SELECT COUNT(*) INTO v_existing_entry_count
  FROM journal_entries
  WHERE reference = NEW.transaction_number
    AND description = 'POS Sale - ' || NEW.transaction_number;

  IF v_existing_entry_count > 0 THEN
    RETURN NEW;
  END IF;

  -- Get account IDs
  SELECT id INTO v_cash_account_id FROM accounts WHERE account_code = '1010' LIMIT 1;
  SELECT id INTO v_mobile_money_account_id FROM accounts WHERE account_code = '1015' LIMIT 1;
  SELECT id INTO v_sales_account_id FROM accounts WHERE account_code = '4010' LIMIT 1;
  SELECT id INTO v_discount_account_id FROM accounts WHERE account_code = '4020' LIMIT 1;
  SELECT id INTO v_tax_account_id FROM accounts WHERE account_code = '2020' LIMIT 1;
  SELECT id INTO v_ar_account_id FROM accounts WHERE account_code = '1030' LIMIT 1;
  SELECT id INTO v_cogs_account_id FROM accounts WHERE account_code = '5010' LIMIT 1;
  SELECT id INTO v_inventory_account_id FROM accounts WHERE account_code = '1020' LIMIT 1;

  -- Get customer ledger account if customer is linked
  IF NEW.customer_id IS NOT NULL THEN
    SELECT customer_ledger_account_id INTO v_customer_ledger_id
    FROM contacts
    WHERE id = NEW.customer_id;
  END IF;

  -- Calculate total COGS from metadata if available
  IF NEW.metadata IS NOT NULL AND NEW.metadata ? 'total_cogs' THEN
    v_total_cogs := (NEW.metadata->>'total_cogs')::NUMERIC;
  END IF;

  -- Create journal entry with COGS included
  INSERT INTO journal_entries (
    description,
    entry_date,
    reference,
    total_debit,
    total_credit,
    status,
    created_by,
    posted_by,
    posted_at
  ) VALUES (
    'POS Sale - ' || NEW.transaction_number,
    CURRENT_DATE,
    NEW.transaction_number,
    CASE 
      WHEN v_customer_ledger_id IS NOT NULL AND NEW.payment_method != 'credit' 
      THEN NEW.total * 2 + v_total_cogs
      ELSE NEW.total + v_total_cogs
    END,
    CASE 
      WHEN v_customer_ledger_id IS NOT NULL AND NEW.payment_method != 'credit' 
      THEN NEW.subtotal + NEW.tax + NEW.total + v_total_cogs
      ELSE NEW.subtotal + NEW.tax + v_total_cogs
    END,
    'posted',
    NEW.cashier_id,
    NEW.cashier_id,
    NOW()
  ) RETURNING id INTO v_journal_entry_id;

  -- Determine payment account
  IF NEW.payment_method = 'mobile_money' THEN
    v_payment_account_id := v_mobile_money_account_id;
  ELSIF NEW.payment_method = 'cash' THEN
    v_payment_account_id := v_cash_account_id;
  END IF;

  -- Customer account logic
  IF v_customer_ledger_id IS NOT NULL THEN
    -- Debit Customer AR (Sale)
    INSERT INTO journal_entry_lines (
      journal_entry_id, account_id, description, debit_amount, credit_amount
    ) VALUES (
      v_journal_entry_id, v_customer_ledger_id, 'Sale to customer', NEW.total, 0
    );

    -- Credit Sales Revenue
    INSERT INTO journal_entry_lines (
      journal_entry_id, account_id, description, debit_amount, credit_amount
    ) VALUES (
      v_journal_entry_id, v_sales_account_id, 'Sales Revenue', 0, NEW.subtotal
    );

    -- If paid immediately
    IF NEW.payment_method != 'credit' AND v_payment_account_id IS NOT NULL THEN
      INSERT INTO journal_entry_lines (
        journal_entry_id, account_id, description, debit_amount, credit_amount
      ) VALUES (
        v_journal_entry_id, v_payment_account_id, 'Payment received - ' || NEW.payment_method, NEW.total, 0
      );

      INSERT INTO journal_entry_lines (
        journal_entry_id, account_id, description, debit_amount, credit_amount
      ) VALUES (
        v_journal_entry_id, v_customer_ledger_id, 'Payment received - ' || NEW.payment_method, 0, NEW.total
      );
    END IF;
  ELSE
    -- No customer linked
    IF v_payment_account_id IS NOT NULL THEN
      INSERT INTO journal_entry_lines (
        journal_entry_id, account_id, description, debit_amount, credit_amount
      ) VALUES (
        v_journal_entry_id, COALESCE(v_payment_account_id, v_ar_account_id), 'POS Sale - ' || NEW.payment_method, NEW.total, 0
      );
    ELSE
      INSERT INTO journal_entry_lines (
        journal_entry_id, account_id, description, debit_amount, credit_amount
      ) VALUES (
        v_journal_entry_id, v_ar_account_id, 'POS Sale - credit', NEW.total, 0
      );
    END IF;

    INSERT INTO journal_entry_lines (
      journal_entry_id, account_id, description, debit_amount, credit_amount
    ) VALUES (
      v_journal_entry_id, v_sales_account_id, 'Sales Revenue', 0, NEW.subtotal
    );
  END IF;

  -- Sales Tax
  IF NEW.tax > 0 THEN
    INSERT INTO journal_entry_lines (
      journal_entry_id, account_id, description, debit_amount, credit_amount
    ) VALUES (
      v_journal_entry_id, v_tax_account_id, 'Sales Tax Collected', 0, NEW.tax
    );
  END IF;

  -- Sales Discount
  IF NEW.discount > 0 AND v_discount_account_id IS NOT NULL THEN
    INSERT INTO journal_entry_lines (
      journal_entry_id, account_id, description, debit_amount, credit_amount
    ) VALUES (
      v_journal_entry_id, v_discount_account_id, 'Sales Discount', NEW.discount, 0
    );
  END IF;

  -- COGS Entry (Debit COGS, Credit Inventory)
  IF v_total_cogs > 0 AND v_cogs_account_id IS NOT NULL AND v_inventory_account_id IS NOT NULL THEN
    INSERT INTO journal_entry_lines (
      journal_entry_id, account_id, description, debit_amount, credit_amount
    ) VALUES (
      v_journal_entry_id, v_cogs_account_id, 'Cost of Goods Sold', v_total_cogs, 0
    );

    INSERT INTO journal_entry_lines (
      journal_entry_id, account_id, description, debit_amount, credit_amount
    ) VALUES (
      v_journal_entry_id, v_inventory_account_id, 'Inventory Reduction', 0, v_total_cogs
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Phase 6: Migrate existing stock to initial inventory layers
INSERT INTO inventory_layers (
  product_id,
  variant_id,
  quantity_purchased,
  quantity_remaining,
  unit_cost,
  purchased_at,
  created_at
)
SELECT 
  p.id,
  NULL,
  p.stock_quantity,
  p.stock_quantity,
  COALESCE(p.cost_price, p.price * 0.7),
  p.created_at,
  NOW()
FROM products p
WHERE p.stock_quantity > 0
  AND NOT EXISTS (
    SELECT 1 FROM inventory_layers il 
    WHERE il.product_id = p.id AND il.variant_id IS NULL
  );

-- Migrate variant stock to layers
INSERT INTO inventory_layers (
  product_id,
  variant_id,
  quantity_purchased,
  quantity_remaining,
  unit_cost,
  purchased_at,
  created_at
)
SELECT 
  pv.product_id,
  pv.id,
  pv.stock_quantity,
  pv.stock_quantity,
  COALESCE(pv.price * 0.7, p.price * 0.7),
  pv.created_at,
  NOW()
FROM product_variants pv
JOIN products p ON p.id = pv.product_id
WHERE pv.stock_quantity > 0
  AND NOT EXISTS (
    SELECT 1 FROM inventory_layers il 
    WHERE il.variant_id = pv.id
  );