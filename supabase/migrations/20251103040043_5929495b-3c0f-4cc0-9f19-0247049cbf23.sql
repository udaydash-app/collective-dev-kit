-- Create custom price tiers table
CREATE TABLE custom_price_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create custom tier prices table (product prices for each tier)
CREATE TABLE custom_tier_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_id UUID NOT NULL REFERENCES custom_price_tiers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  price NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(tier_id, product_id)
);

-- Add custom price tier column to contacts
ALTER TABLE contacts ADD COLUMN custom_price_tier_id UUID REFERENCES custom_price_tiers(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE custom_price_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_tier_prices ENABLE ROW LEVEL SECURITY;

-- RLS Policies for custom_price_tiers
CREATE POLICY "Admins can view all custom price tiers"
  ON custom_price_tiers FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert custom price tiers"
  ON custom_price_tiers FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update custom price tiers"
  ON custom_price_tiers FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete custom price tiers"
  ON custom_price_tiers FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Cashiers can view custom price tiers"
  ON custom_price_tiers FOR SELECT
  USING (has_role(auth.uid(), 'cashier'::app_role));

-- RLS Policies for custom_tier_prices
CREATE POLICY "Admins can view all custom tier prices"
  ON custom_tier_prices FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert custom tier prices"
  ON custom_tier_prices FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update custom tier prices"
  ON custom_tier_prices FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete custom tier prices"
  ON custom_tier_prices FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Cashiers can view custom tier prices"
  ON custom_tier_prices FOR SELECT
  USING (has_role(auth.uid(), 'cashier'::app_role));

-- Create index for performance
CREATE INDEX idx_custom_tier_prices_tier_id ON custom_tier_prices(tier_id);
CREATE INDEX idx_custom_tier_prices_product_id ON custom_tier_prices(product_id);
CREATE INDEX idx_contacts_custom_price_tier_id ON contacts(custom_price_tier_id);

-- Create trigger for updated_at
CREATE TRIGGER update_custom_price_tiers_updated_at
  BEFORE UPDATE ON custom_price_tiers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_custom_tier_prices_updated_at
  BEFORE UPDATE ON custom_tier_prices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();