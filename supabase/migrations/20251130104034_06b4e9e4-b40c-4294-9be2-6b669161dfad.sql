-- Create purchase_orders table
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number TEXT UNIQUE NOT NULL DEFAULT ('PO-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 10))),
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
  supplier_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
  supplier_name TEXT NOT NULL,
  supplier_email TEXT,
  supplier_phone TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'quote_received', 'accepted', 'converted', 'cancelled')),
  notes TEXT,
  share_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(32), 'base64'),
  valid_until DATE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create purchase_order_items table
CREATE TABLE IF NOT EXISTS public.purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID REFERENCES public.purchase_orders(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  variant_id UUID REFERENCES public.product_variants(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  variant_name TEXT,
  requested_quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create purchase_order_responses table (supplier's quote)
CREATE TABLE IF NOT EXISTS public.purchase_order_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID REFERENCES public.purchase_orders(id) ON DELETE CASCADE NOT NULL,
  item_id UUID REFERENCES public.purchase_order_items(id) ON DELETE CASCADE NOT NULL,
  cartons INTEGER DEFAULT 0,
  bags INTEGER DEFAULT 0,
  pieces INTEGER DEFAULT 0,
  weight NUMERIC DEFAULT 0,
  weight_unit TEXT DEFAULT 'kg' CHECK (weight_unit IN ('kg', 'lb', 'g', 'ton')),
  price NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  notes TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create purchase_order_charges table
CREATE TABLE IF NOT EXISTS public.purchase_order_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID REFERENCES public.purchase_orders(id) ON DELETE CASCADE NOT NULL,
  charge_type TEXT NOT NULL CHECK (charge_type IN ('freight', 'clearing', 'customs', 'handling', 'other')),
  description TEXT,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_charges ENABLE ROW LEVEL SECURITY;

-- RLS Policies for purchase_orders
CREATE POLICY "Admins can view all purchase orders" ON public.purchase_orders FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert purchase orders" ON public.purchase_orders FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update purchase orders" ON public.purchase_orders FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete purchase orders" ON public.purchase_orders FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Cashiers can view purchase orders" ON public.purchase_orders FOR SELECT USING (has_role(auth.uid(), 'cashier'::app_role));
CREATE POLICY "Cashiers can insert purchase orders" ON public.purchase_orders FOR INSERT WITH CHECK (has_role(auth.uid(), 'cashier'::app_role));
CREATE POLICY "Cashiers can update purchase orders" ON public.purchase_orders FOR UPDATE USING (has_role(auth.uid(), 'cashier'::app_role));

-- RLS Policies for purchase_order_items
CREATE POLICY "Admins can view all PO items" ON public.purchase_order_items FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert PO items" ON public.purchase_order_items FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update PO items" ON public.purchase_order_items FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete PO items" ON public.purchase_order_items FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Cashiers can view PO items" ON public.purchase_order_items FOR SELECT USING (has_role(auth.uid(), 'cashier'::app_role));
CREATE POLICY "Cashiers can insert PO items" ON public.purchase_order_items FOR INSERT WITH CHECK (has_role(auth.uid(), 'cashier'::app_role));
CREATE POLICY "Cashiers can update PO items" ON public.purchase_order_items FOR UPDATE USING (has_role(auth.uid(), 'cashier'::app_role));

-- RLS Policies for purchase_order_responses (allow public insert via share_token validation)
CREATE POLICY "Admins can view all PO responses" ON public.purchase_order_responses FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Cashiers can view PO responses" ON public.purchase_order_responses FOR SELECT USING (has_role(auth.uid(), 'cashier'::app_role));
CREATE POLICY "Anyone can insert PO responses" ON public.purchase_order_responses FOR INSERT WITH CHECK (true);

-- RLS Policies for purchase_order_charges
CREATE POLICY "Admins can view all PO charges" ON public.purchase_order_charges FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert PO charges" ON public.purchase_order_charges FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update PO charges" ON public.purchase_order_charges FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete PO charges" ON public.purchase_order_charges FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Cashiers can view PO charges" ON public.purchase_order_charges FOR SELECT USING (has_role(auth.uid(), 'cashier'::app_role));
CREATE POLICY "Cashiers can insert PO charges" ON public.purchase_order_charges FOR INSERT WITH CHECK (has_role(auth.uid(), 'cashier'::app_role));
CREATE POLICY "Cashiers can update PO charges" ON public.purchase_order_charges FOR UPDATE USING (has_role(auth.uid(), 'cashier'::app_role));

-- Create indexes
CREATE INDEX idx_purchase_orders_store_id ON public.purchase_orders(store_id);
CREATE INDEX idx_purchase_orders_supplier_id ON public.purchase_orders(supplier_id);
CREATE INDEX idx_purchase_orders_status ON public.purchase_orders(status);
CREATE INDEX idx_purchase_orders_share_token ON public.purchase_orders(share_token);
CREATE INDEX idx_purchase_order_items_po_id ON public.purchase_order_items(purchase_order_id);
CREATE INDEX idx_purchase_order_responses_po_id ON public.purchase_order_responses(purchase_order_id);
CREATE INDEX idx_purchase_order_charges_po_id ON public.purchase_order_charges(purchase_order_id);