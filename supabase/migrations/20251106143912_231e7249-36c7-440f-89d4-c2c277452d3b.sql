-- Create multi_product_bogo_offers table
CREATE TABLE multi_product_bogo_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  discount_percentage NUMERIC NOT NULL DEFAULT 50,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  max_uses_per_transaction INTEGER,
  max_total_uses INTEGER,
  current_uses INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE multi_product_bogo_offers ENABLE ROW LEVEL SECURITY;

-- Create policies for multi_product_bogo_offers
CREATE POLICY "Allow read access to multi_product_bogo_offers"
  ON multi_product_bogo_offers FOR SELECT
  USING (true);

CREATE POLICY "Allow authenticated users to manage multi_product_bogo_offers"
  ON multi_product_bogo_offers FOR ALL
  USING (auth.role() = 'authenticated');

-- Create junction table for products in the offer
CREATE TABLE multi_product_bogo_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID REFERENCES multi_product_bogo_offers(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(offer_id, product_id, variant_id)
);

-- Enable RLS
ALTER TABLE multi_product_bogo_items ENABLE ROW LEVEL SECURITY;

-- Create policies for multi_product_bogo_items
CREATE POLICY "Allow read access to multi_product_bogo_items"
  ON multi_product_bogo_items FOR SELECT
  USING (true);

CREATE POLICY "Allow authenticated users to manage multi_product_bogo_items"
  ON multi_product_bogo_items FOR ALL
  USING (auth.role() = 'authenticated');

-- Add indexes
CREATE INDEX idx_multi_bogo_offers_active ON multi_product_bogo_offers(is_active, start_date, end_date);
CREATE INDEX idx_multi_bogo_items_offer ON multi_product_bogo_items(offer_id);
CREATE INDEX idx_multi_bogo_items_product ON multi_product_bogo_items(product_id);
CREATE INDEX idx_multi_bogo_items_variant ON multi_product_bogo_items(variant_id);

-- Create trigger for updated_at
CREATE TRIGGER update_multi_product_bogo_offers_updated_at
  BEFORE UPDATE ON multi_product_bogo_offers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();