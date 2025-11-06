-- Create BOGO (Buy One Get One) offers table
CREATE TABLE IF NOT EXISTS bogo_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  
  -- Buy product configuration
  buy_product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  buy_variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
  buy_quantity INTEGER NOT NULL DEFAULT 1,
  
  -- Get product configuration
  get_product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  get_variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
  get_quantity INTEGER NOT NULL DEFAULT 1,
  get_discount_percentage INTEGER NOT NULL DEFAULT 100, -- 100 = free, 50 = half off
  
  -- Offer details
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  
  -- Limits
  max_uses_per_transaction INTEGER, -- NULL = unlimited
  max_total_uses INTEGER, -- NULL = unlimited
  current_uses INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CHECK (buy_quantity > 0),
  CHECK (get_quantity > 0),
  CHECK (get_discount_percentage >= 0 AND get_discount_percentage <= 100),
  CHECK (buy_product_id IS NOT NULL OR buy_variant_id IS NOT NULL),
  CHECK (get_product_id IS NOT NULL OR get_variant_id IS NOT NULL)
);

-- Enable RLS
ALTER TABLE bogo_offers ENABLE ROW LEVEL SECURITY;

-- Admin policies
CREATE POLICY "Admins can view all bogo offers"
  ON bogo_offers FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert bogo offers"
  ON bogo_offers FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update bogo offers"
  ON bogo_offers FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete bogo offers"
  ON bogo_offers FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Cashier policies
CREATE POLICY "Cashiers can view bogo offers"
  ON bogo_offers FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'cashier'::app_role));

CREATE POLICY "Cashiers can insert bogo offers"
  ON bogo_offers FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'cashier'::app_role));

CREATE POLICY "Cashiers can update bogo offers"
  ON bogo_offers FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'cashier'::app_role));

CREATE POLICY "Cashiers can delete bogo offers"
  ON bogo_offers FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'cashier'::app_role));

-- Public can view active offers
CREATE POLICY "Anyone can view active bogo offers"
  ON bogo_offers FOR SELECT
  TO public
  USING (
    is_active = true 
    AND start_date <= NOW() 
    AND end_date >= NOW()
    AND (max_total_uses IS NULL OR current_uses < max_total_uses)
  );

-- Create index for performance
CREATE INDEX idx_bogo_offers_active ON bogo_offers(is_active, start_date, end_date);
CREATE INDEX idx_bogo_offers_buy_product ON bogo_offers(buy_product_id);
CREATE INDEX idx_bogo_offers_buy_variant ON bogo_offers(buy_variant_id);

-- Trigger for updated_at
CREATE TRIGGER update_bogo_offers_updated_at
  BEFORE UPDATE ON bogo_offers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();