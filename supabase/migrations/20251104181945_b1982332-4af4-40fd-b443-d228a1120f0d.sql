-- Create combo offers table
CREATE TABLE combo_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  combo_price NUMERIC NOT NULL,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create combo offer items table (junction table)
CREATE TABLE combo_offer_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  combo_offer_id UUID REFERENCES combo_offers(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_combo_offer_items_combo ON combo_offer_items(combo_offer_id);
CREATE INDEX idx_combo_offer_items_product ON combo_offer_items(product_id);
CREATE INDEX idx_combo_offers_active ON combo_offers(is_active);

-- Enable RLS
ALTER TABLE combo_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE combo_offer_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for combo_offers
CREATE POLICY "Admins can view all combo offers"
  ON combo_offers FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Cashiers can view combo offers"
  ON combo_offers FOR SELECT
  USING (has_role(auth.uid(), 'cashier'::app_role));

CREATE POLICY "Anyone can view active combo offers"
  ON combo_offers FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can insert combo offers"
  ON combo_offers FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update combo offers"
  ON combo_offers FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete combo offers"
  ON combo_offers FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Cashiers can insert combo offers"
  ON combo_offers FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'cashier'::app_role));

CREATE POLICY "Cashiers can update combo offers"
  ON combo_offers FOR UPDATE
  USING (has_role(auth.uid(), 'cashier'::app_role));

CREATE POLICY "Cashiers can delete combo offers"
  ON combo_offers FOR DELETE
  USING (has_role(auth.uid(), 'cashier'::app_role));

-- RLS Policies for combo_offer_items
CREATE POLICY "Admins can view all combo offer items"
  ON combo_offer_items FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Cashiers can view combo offer items"
  ON combo_offer_items FOR SELECT
  USING (has_role(auth.uid(), 'cashier'::app_role));

CREATE POLICY "Anyone can view active combo offer items"
  ON combo_offer_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM combo_offers
      WHERE combo_offers.id = combo_offer_items.combo_offer_id
      AND combo_offers.is_active = true
    )
  );

CREATE POLICY "Admins can insert combo offer items"
  ON combo_offer_items FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update combo offer items"
  ON combo_offer_items FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete combo offer items"
  ON combo_offer_items FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Cashiers can insert combo offer items"
  ON combo_offer_items FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'cashier'::app_role));

CREATE POLICY "Cashiers can update combo offer items"
  ON combo_offer_items FOR UPDATE
  USING (has_role(auth.uid(), 'cashier'::app_role));

CREATE POLICY "Cashiers can delete combo offer items"
  ON combo_offer_items FOR DELETE
  USING (has_role(auth.uid(), 'cashier'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_combo_offers_updated_at
  BEFORE UPDATE ON combo_offers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();