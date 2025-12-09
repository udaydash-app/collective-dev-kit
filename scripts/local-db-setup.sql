-- ===========================================
-- LOCAL SUPABASE COMPLETE SCHEMA SETUP
-- Run this in Supabase Studio SQL Editor
-- http://192.168.1.11:3000 -> SQL Editor
-- ===========================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ===========================================
-- CUSTOM TYPES / ENUMS
-- ===========================================

DO $$ BEGIN
  CREATE TYPE app_role AS ENUM ('admin', 'cashier', 'user');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE account_type AS ENUM ('asset', 'liability', 'equity', 'revenue', 'expense');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE price_tier AS ENUM ('retail', 'wholesale', 'vip');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ===========================================
-- CORE TABLES
-- ===========================================

-- Profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  role TEXT DEFAULT 'user',
  language TEXT DEFAULT 'en',
  region TEXT,
  currency TEXT DEFAULT 'XOF',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- User roles table
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Stores table
CREATE TABLE IF NOT EXISTS public.stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  logo_url TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  opening_hours JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Categories table
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  image_url TEXT,
  parent_id UUID REFERENCES public.categories(id),
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Accounts table (Chart of Accounts)
CREATE TABLE IF NOT EXISTS public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_code TEXT NOT NULL,
  account_name TEXT NOT NULL,
  account_type account_type NOT NULL,
  description TEXT,
  parent_account_id UUID REFERENCES public.accounts(id),
  opening_balance NUMERIC DEFAULT 0,
  current_balance NUMERIC DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Contacts table (Customers & Suppliers)
CREATE TABLE IF NOT EXISTS public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  contact_person TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  country TEXT,
  tax_id TEXT,
  notes TEXT,
  is_customer BOOLEAN DEFAULT false,
  is_supplier BOOLEAN DEFAULT false,
  credit_limit NUMERIC,
  opening_balance NUMERIC DEFAULT 0,
  supplier_opening_balance NUMERIC DEFAULT 0,
  price_tier price_tier DEFAULT 'retail',
  discount_percentage NUMERIC DEFAULT 0,
  custom_price_tier_id UUID,
  customer_ledger_account_id UUID REFERENCES public.accounts(id),
  supplier_ledger_account_id UUID REFERENCES public.accounts(id),
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Products table
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  barcode TEXT,
  price NUMERIC,
  original_price NUMERIC,
  cost_price NUMERIC,
  wholesale_price NUMERIC,
  vip_price NUMERIC,
  unit TEXT NOT NULL DEFAULT 'piece',
  stock_quantity NUMERIC DEFAULT 0,
  image_url TEXT,
  images TEXT[],
  category_id UUID REFERENCES public.categories(id),
  store_id UUID NOT NULL REFERENCES public.stores(id),
  supplier_id UUID REFERENCES public.contacts(id),
  is_available BOOLEAN DEFAULT true,
  is_available_online BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  tags TEXT[],
  nutritional_info JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Product Variants table
CREATE TABLE IF NOT EXISTS public.product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  label TEXT,
  unit TEXT NOT NULL,
  quantity NUMERIC,
  price NUMERIC NOT NULL,
  cost_price NUMERIC,
  wholesale_price NUMERIC,
  vip_price NUMERIC,
  barcode TEXT,
  stock_quantity NUMERIC DEFAULT 0,
  is_default BOOLEAN DEFAULT false,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- POS Users table
CREATE TABLE IF NOT EXISTS public.pos_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  full_name TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- POS Transactions table
CREATE TABLE IF NOT EXISTS public.pos_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_number TEXT NOT NULL DEFAULT ('TXN-' || upper(substring(md5(random()::text) from 1 for 10))),
  store_id UUID NOT NULL REFERENCES public.stores(id),
  cashier_id UUID NOT NULL,
  customer_id UUID REFERENCES public.contacts(id),
  items JSONB NOT NULL DEFAULT '[]',
  subtotal NUMERIC NOT NULL,
  discount NUMERIC DEFAULT 0,
  tax NUMERIC DEFAULT 0,
  total NUMERIC NOT NULL,
  amount_paid NUMERIC,
  payment_method TEXT NOT NULL,
  payment_details JSONB,
  notes TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Purchases table
CREATE TABLE IF NOT EXISTS public.purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_number TEXT NOT NULL DEFAULT ('PUR-' || upper(substring(md5(random()::text) from 1 for 10))),
  supplier_name TEXT NOT NULL,
  supplier_id UUID REFERENCES public.contacts(id),
  store_id UUID NOT NULL REFERENCES public.stores(id),
  purchase_date DATE DEFAULT CURRENT_DATE,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  amount_paid NUMERIC DEFAULT 0,
  payment_status TEXT DEFAULT 'pending',
  payment_method TEXT,
  payment_details JSONB,
  notes TEXT,
  purchased_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Purchase Items table
CREATE TABLE IF NOT EXISTS public.purchase_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  variant_id UUID REFERENCES public.product_variants(id),
  quantity NUMERIC NOT NULL,
  unit_cost NUMERIC NOT NULL,
  total_cost NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Orders table
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL,
  user_id UUID,
  customer_id UUID REFERENCES public.contacts(id),
  store_id UUID NOT NULL REFERENCES public.stores(id),
  address_id UUID,
  payment_method_id UUID,
  subtotal NUMERIC NOT NULL,
  delivery_fee NUMERIC DEFAULT 0,
  tax NUMERIC DEFAULT 0,
  total NUMERIC NOT NULL,
  status TEXT DEFAULT 'pending',
  payment_status TEXT,
  payment_method TEXT,
  stripe_payment_intent_id TEXT,
  delivery_date DATE,
  delivery_time_slot TEXT,
  delivery_instructions TEXT,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Order Items table
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  quantity INTEGER NOT NULL,
  unit_price NUMERIC NOT NULL,
  subtotal NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Journal Entries table
CREATE TABLE IF NOT EXISTS public.journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_number TEXT NOT NULL DEFAULT ('JE-' || upper(substring(md5(random()::text) from 1 for 10))),
  entry_date DATE DEFAULT CURRENT_DATE,
  description TEXT NOT NULL,
  reference TEXT,
  total_debit NUMERIC DEFAULT 0,
  total_credit NUMERIC DEFAULT 0,
  transaction_amount NUMERIC,
  status TEXT DEFAULT 'draft',
  notes TEXT,
  created_by UUID,
  posted_by UUID,
  posted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Journal Entry Lines table
CREATE TABLE IF NOT EXISTS public.journal_entry_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id UUID NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id),
  description TEXT,
  debit_amount NUMERIC DEFAULT 0,
  credit_amount NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Expenses table
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id),
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  expense_date DATE DEFAULT CURRENT_DATE,
  payment_method TEXT NOT NULL,
  receipt_url TEXT,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Payment Receipts table
CREATE TABLE IF NOT EXISTS public.payment_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number TEXT NOT NULL DEFAULT ('RCP-' || upper(substring(md5(random()::text) from 1 for 10))),
  contact_id UUID NOT NULL REFERENCES public.contacts(id),
  store_id UUID NOT NULL REFERENCES public.stores(id),
  amount NUMERIC NOT NULL,
  payment_date DATE DEFAULT CURRENT_DATE,
  payment_method TEXT NOT NULL,
  reference TEXT,
  notes TEXT,
  received_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Supplier Payments table
CREATE TABLE IF NOT EXISTS public.supplier_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_number TEXT NOT NULL DEFAULT ('SPY-' || upper(substring(md5(random()::text) from 1 for 10))),
  contact_id UUID NOT NULL REFERENCES public.contacts(id),
  purchase_id UUID REFERENCES public.purchases(id),
  store_id UUID NOT NULL REFERENCES public.stores(id),
  amount NUMERIC NOT NULL,
  payment_date DATE DEFAULT CURRENT_DATE,
  payment_method TEXT NOT NULL,
  reference TEXT,
  notes TEXT,
  paid_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Cash Sessions table
CREATE TABLE IF NOT EXISTS public.cash_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id),
  cashier_id UUID NOT NULL,
  opening_cash NUMERIC DEFAULT 0,
  closing_cash NUMERIC,
  expected_cash NUMERIC,
  cash_difference NUMERIC,
  status TEXT DEFAULT 'open',
  notes TEXT,
  opened_at TIMESTAMPTZ DEFAULT now(),
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Inventory Layers table (for FIFO)
CREATE TABLE IF NOT EXISTS public.inventory_layers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id),
  variant_id UUID REFERENCES public.product_variants(id),
  purchase_id UUID REFERENCES public.purchases(id),
  purchase_item_id UUID REFERENCES public.purchase_items(id),
  quantity_purchased NUMERIC NOT NULL,
  quantity_remaining NUMERIC NOT NULL,
  unit_cost NUMERIC NOT NULL,
  purchased_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Stock Adjustments table
CREATE TABLE IF NOT EXISTS public.stock_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id),
  variant_id UUID REFERENCES public.product_variants(id),
  adjustment_type TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  previous_quantity NUMERIC,
  new_quantity NUMERIC,
  unit_cost NUMERIC,
  total_value NUMERIC,
  reason TEXT,
  notes TEXT,
  adjusted_by UUID,
  adjustment_date TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Addresses table
CREATE TABLE IF NOT EXISTS public.addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  label TEXT NOT NULL,
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip_code TEXT NOT NULL,
  phone TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Payment Methods table
CREATE TABLE IF NOT EXISTS public.payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type TEXT NOT NULL,
  label TEXT NOT NULL,
  last_four TEXT,
  expiry_month INTEGER,
  expiry_year INTEGER,
  stripe_payment_method_id TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Favorites table
CREATE TABLE IF NOT EXISTS public.favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, product_id)
);

-- Cart Items table
CREATE TABLE IF NOT EXISTS public.cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES public.product_variants(id),
  quantity INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Announcements table
CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  start_date TIMESTAMPTZ DEFAULT now(),
  end_date TIMESTAMPTZ NOT NULL,
  background_color TEXT DEFAULT '#22C55E',
  text_color TEXT DEFAULT '#FFFFFF',
  background_image_url TEXT,
  title_font_size TEXT DEFAULT 'text-xl',
  title_font_weight TEXT DEFAULT 'font-bold',
  message_font_size TEXT DEFAULT 'text-base',
  message_font_weight TEXT DEFAULT 'font-normal',
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Offers table
CREATE TABLE IF NOT EXISTS public.offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  link_url TEXT,
  discount_percentage NUMERIC,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- BOGO Offers table
CREATE TABLE IF NOT EXISTS public.bogo_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  buy_product_id UUID REFERENCES public.products(id),
  buy_variant_id UUID REFERENCES public.product_variants(id),
  buy_quantity INTEGER DEFAULT 1,
  get_product_id UUID REFERENCES public.products(id),
  get_variant_id UUID REFERENCES public.product_variants(id),
  get_quantity INTEGER DEFAULT 1,
  get_discount_percentage INTEGER DEFAULT 100,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  max_uses_per_transaction INTEGER,
  max_total_uses INTEGER,
  current_uses INTEGER DEFAULT 0,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Combo Offers table
CREATE TABLE IF NOT EXISTS public.combo_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  combo_price NUMERIC NOT NULL,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Combo Offer Items table
CREATE TABLE IF NOT EXISTS public.combo_offer_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  combo_offer_id UUID NOT NULL REFERENCES public.combo_offers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  variant_id UUID REFERENCES public.product_variants(id),
  quantity INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Multi-Product BOGO Offers table
CREATE TABLE IF NOT EXISTS public.multi_product_bogo_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  discount_percentage NUMERIC DEFAULT 50,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  max_uses_per_transaction INTEGER,
  max_total_uses INTEGER,
  current_uses INTEGER DEFAULT 0,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Multi-Product BOGO Items table
CREATE TABLE IF NOT EXISTS public.multi_product_bogo_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID REFERENCES public.multi_product_bogo_offers(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  variant_id UUID REFERENCES public.product_variants(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Custom Price Tiers table
CREATE TABLE IF NOT EXISTS public.custom_price_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Custom Tier Prices table
CREATE TABLE IF NOT EXISTS public.custom_tier_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_id UUID NOT NULL REFERENCES public.custom_price_tiers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  price NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Customer Product Prices table
CREATE TABLE IF NOT EXISTS public.customer_product_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  price NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Chat Conversations table
CREATE TABLE IF NOT EXISTS public.chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  status TEXT DEFAULT 'open',
  last_message_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Chat Messages table
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  sender_id UUID,
  sender_type TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Purchase Orders table
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number TEXT NOT NULL DEFAULT ('PO-' || upper(substring(md5(random()::text) from 1 for 10))),
  supplier_id UUID REFERENCES public.contacts(id),
  store_id UUID REFERENCES public.stores(id),
  status TEXT DEFAULT 'draft',
  share_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  notes TEXT,
  expected_delivery_date DATE,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Purchase Order Items table
CREATE TABLE IF NOT EXISTS public.purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  variant_id UUID REFERENCES public.product_variants(id),
  product_name TEXT NOT NULL,
  variant_name TEXT,
  requested_quantity NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Purchase Order Responses table
CREATE TABLE IF NOT EXISTS public.purchase_order_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.purchase_order_items(id) ON DELETE CASCADE,
  cartons NUMERIC,
  bags NUMERIC,
  pieces NUMERIC,
  weight NUMERIC,
  weight_unit TEXT,
  price NUMERIC NOT NULL,
  currency TEXT DEFAULT 'USD',
  notes TEXT,
  submitted_at TIMESTAMPTZ DEFAULT now()
);

-- Purchase Order Charges table
CREATE TABLE IF NOT EXISTS public.purchase_order_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  charge_type TEXT NOT NULL,
  description TEXT,
  amount NUMERIC NOT NULL,
  currency TEXT DEFAULT 'USD',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Quotations table
CREATE TABLE IF NOT EXISTS public.quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_number TEXT NOT NULL DEFAULT ('QT-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0')),
  customer_id UUID REFERENCES public.contacts(id),
  store_id UUID REFERENCES public.stores(id),
  subtotal NUMERIC DEFAULT 0,
  discount NUMERIC DEFAULT 0,
  tax NUMERIC DEFAULT 0,
  total NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'draft',
  valid_until DATE,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Quotation Items table
CREATE TABLE IF NOT EXISTS public.quotation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  variant_id UUID REFERENCES public.product_variants(id),
  quantity NUMERIC NOT NULL,
  unit_price NUMERIC NOT NULL,
  discount NUMERIC DEFAULT 0,
  subtotal NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Productions table
CREATE TABLE IF NOT EXISTS public.productions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_number TEXT NOT NULL DEFAULT ('PRD-' || upper(substring(md5(random()::text) from 1 for 10))),
  source_product_id UUID REFERENCES public.products(id),
  source_variant_id UUID REFERENCES public.product_variants(id),
  source_quantity NUMERIC NOT NULL,
  status TEXT DEFAULT 'pending',
  production_date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Production Outputs table
CREATE TABLE IF NOT EXISTS public.production_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_id UUID NOT NULL REFERENCES public.productions(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  variant_id UUID REFERENCES public.product_variants(id),
  quantity NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Analytics Events table
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  event_type TEXT NOT NULL,
  event_data JSONB,
  page_url TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Import Logs table
CREATE TABLE IF NOT EXISTS public.import_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES public.stores(id),
  url TEXT NOT NULL,
  status TEXT NOT NULL,
  error_message TEXT,
  products_imported INTEGER DEFAULT 0,
  execution_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Backup Settings table
CREATE TABLE IF NOT EXISTS public.backup_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auto_backup_enabled BOOLEAN DEFAULT false,
  backup_frequency_hours INTEGER DEFAULT 24,
  last_backup_at TIMESTAMPTZ,
  next_backup_at TIMESTAMPTZ,
  tables_to_backup TEXT[] DEFAULT ARRAY['products', 'product_variants', 'categories', 'contacts', 'purchases', 'purchase_items', 'pos_transactions', 'orders', 'inventory_layers', 'stock_adjustments'],
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Backup Logs table
CREATE TABLE IF NOT EXISTS public.backup_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_type TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  tables_backed_up TEXT[] DEFAULT '{}',
  records_count JSONB DEFAULT '{}',
  backup_size_bytes BIGINT,
  triggered_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Cloud Backups table
CREATE TABLE IF NOT EXISTS public.cloud_backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_name TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  backup_size BIGINT DEFAULT 0,
  table_count INTEGER DEFAULT 0,
  record_count INTEGER DEFAULT 0,
  metadata JSONB,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ===========================================
-- CORE FUNCTIONS
-- ===========================================

-- has_role function
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- verify_pin function
CREATE OR REPLACE FUNCTION public.verify_pin(input_pin TEXT)
RETURNS TABLE(pos_user_id UUID, user_id UUID, full_name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  RETURN QUERY
  SELECT pu.id as pos_user_id, pu.user_id, pu.full_name
  FROM pos_users pu
  WHERE pu.pin_hash = extensions.crypt(input_pin, pu.pin_hash)
    AND pu.is_active = true;
END;
$$;

-- crypt_pin function
CREATE OR REPLACE FUNCTION public.crypt_pin(input_pin TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  RETURN extensions.crypt(input_pin, extensions.gen_salt('bf'));
END;
$$;

-- update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- get_top_credit_customers function
CREATE OR REPLACE FUNCTION public.get_top_credit_customers(limit_count INTEGER DEFAULT 10)
RETURNS TABLE(id UUID, name TEXT, phone TEXT, email TEXT, balance NUMERIC, customer_balance NUMERIC, supplier_balance NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.name,
    c.phone,
    c.email,
    CASE 
      WHEN c.supplier_ledger_account_id IS NOT NULL THEN 
        COALESCE(ca.current_balance, 0) - COALESCE(sa.current_balance, 0)
      ELSE 
        COALESCE(ca.current_balance, 0)
    END as balance,
    COALESCE(ca.current_balance, 0) as customer_balance,
    COALESCE(sa.current_balance, 0) as supplier_balance
  FROM contacts c
  LEFT JOIN accounts ca ON ca.id = c.customer_ledger_account_id
  LEFT JOIN accounts sa ON sa.id = c.supplier_ledger_account_id
  WHERE c.is_customer = true
    AND c.customer_ledger_account_id IS NOT NULL
    AND COALESCE(ca.current_balance, 0) > 0
  ORDER BY balance DESC
  LIMIT limit_count;
END;
$$;

-- deduct_stock_simple trigger function
CREATE OR REPLACE FUNCTION public.deduct_stock_simple()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  item jsonb;
BEGIN
  FOR item IN SELECT * FROM jsonb_array_elements(NEW.items)
  LOOP
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
  RETURN NEW;
END;
$$;

-- restore_stock_on_transaction_delete trigger function
CREATE OR REPLACE FUNCTION public.restore_stock_on_transaction_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  item jsonb;
BEGIN
  FOR item IN SELECT * FROM jsonb_array_elements(OLD.items)
  LOOP
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
  RETURN OLD;
END;
$$;

-- ===========================================
-- TRIGGERS
-- ===========================================

-- Stock deduction trigger
DROP TRIGGER IF EXISTS deduct_stock_on_transaction ON public.pos_transactions;
CREATE TRIGGER deduct_stock_on_transaction
  AFTER INSERT ON public.pos_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.deduct_stock_simple();

-- Stock restoration trigger
DROP TRIGGER IF EXISTS restore_stock_on_transaction_delete ON public.pos_transactions;
CREATE TRIGGER restore_stock_on_transaction_delete
  BEFORE DELETE ON public.pos_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.restore_stock_on_transaction_delete();

-- Updated_at triggers
CREATE OR REPLACE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_stores_updated_at BEFORE UPDATE ON public.stores FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_categories_updated_at BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_product_variants_updated_at BEFORE UPDATE ON public.product_variants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_contacts_updated_at BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_accounts_updated_at BEFORE UPDATE ON public.accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- DISABLE RLS FOR LOCAL DEVELOPMENT
-- (Service role key bypasses RLS anyway)
-- ===========================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entry_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_layers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_adjustments ENABLE ROW LEVEL SECURITY;

-- Create permissive policies for service_role access
-- Service role bypasses RLS, but we add these for completeness

CREATE POLICY "Allow all for service role" ON public.profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON public.user_roles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON public.stores FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON public.categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON public.products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON public.product_variants FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON public.contacts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON public.accounts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON public.pos_users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON public.pos_transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON public.purchases FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON public.purchase_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON public.orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON public.order_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON public.journal_entries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON public.journal_entry_lines FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON public.expenses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON public.payment_receipts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON public.supplier_payments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON public.cash_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON public.inventory_layers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON public.stock_adjustments FOR ALL USING (true) WITH CHECK (true);

-- ===========================================
-- INSERT DEFAULT DATA
-- ===========================================

-- Insert a default store if none exists
INSERT INTO public.stores (id, name, description, is_active)
SELECT gen_random_uuid(), 'Global Market', 'Main store', true
WHERE NOT EXISTS (SELECT 1 FROM public.stores LIMIT 1);

-- ===========================================
-- GRANT PERMISSIONS
-- ===========================================

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

-- ===========================================
-- DONE!
-- ===========================================
SELECT 'Local database schema setup complete!' as status;
