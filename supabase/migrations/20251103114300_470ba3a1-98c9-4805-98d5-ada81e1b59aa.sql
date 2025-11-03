-- Grant full admin access to cashiers by adding comprehensive RLS policies

-- Accounts: Add cashier full access
DROP POLICY IF EXISTS "Cashiers can insert accounts" ON accounts;
DROP POLICY IF EXISTS "Cashiers can update accounts" ON accounts;
DROP POLICY IF EXISTS "Cashiers can delete accounts" ON accounts;

CREATE POLICY "Cashiers can insert accounts" ON accounts
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'cashier'));

CREATE POLICY "Cashiers can update accounts" ON accounts
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'cashier'));

CREATE POLICY "Cashiers can delete accounts" ON accounts
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'cashier'));

-- Announcements: Add cashier full access
DROP POLICY IF EXISTS "Cashiers can insert announcements" ON announcements;
DROP POLICY IF EXISTS "Cashiers can update announcements" ON announcements;
DROP POLICY IF EXISTS "Cashiers can delete announcements" ON announcements;

CREATE POLICY "Cashiers can insert announcements" ON announcements
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'cashier'));

CREATE POLICY "Cashiers can update announcements" ON announcements
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'cashier'));

CREATE POLICY "Cashiers can delete announcements" ON announcements
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'cashier'));

-- Categories: Add cashier full access
DROP POLICY IF EXISTS "Cashiers can insert categories" ON categories;
DROP POLICY IF EXISTS "Cashiers can update categories" ON categories;
DROP POLICY IF EXISTS "Cashiers can delete categories" ON categories;

CREATE POLICY "Cashiers can insert categories" ON categories
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'cashier'));

CREATE POLICY "Cashiers can update categories" ON categories
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'cashier'));

CREATE POLICY "Cashiers can delete categories" ON categories
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'cashier'));

-- Custom price tiers: Add cashier full access
DROP POLICY IF EXISTS "Cashiers can insert custom price tiers" ON custom_price_tiers;
DROP POLICY IF EXISTS "Cashiers can update custom price tiers" ON custom_price_tiers;
DROP POLICY IF EXISTS "Cashiers can delete custom price tiers" ON custom_price_tiers;

CREATE POLICY "Cashiers can insert custom price tiers" ON custom_price_tiers
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'cashier'));

CREATE POLICY "Cashiers can update custom price tiers" ON custom_price_tiers
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'cashier'));

CREATE POLICY "Cashiers can delete custom price tiers" ON custom_price_tiers
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'cashier'));

-- Custom tier prices: Add cashier full access
DROP POLICY IF EXISTS "Cashiers can insert custom tier prices" ON custom_tier_prices;
DROP POLICY IF EXISTS "Cashiers can update custom tier prices" ON custom_tier_prices;
DROP POLICY IF EXISTS "Cashiers can delete custom tier prices" ON custom_tier_prices;

CREATE POLICY "Cashiers can insert custom tier prices" ON custom_tier_prices
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'cashier'));

CREATE POLICY "Cashiers can update custom tier prices" ON custom_tier_prices
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'cashier'));

CREATE POLICY "Cashiers can delete custom tier prices" ON custom_tier_prices
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'cashier'));

-- Customer product prices: Add cashier full access
DROP POLICY IF EXISTS "Cashiers can insert customer product prices" ON customer_product_prices;
DROP POLICY IF EXISTS "Cashiers can update customer product prices" ON customer_product_prices;
DROP POLICY IF EXISTS "Cashiers can delete customer product prices" ON customer_product_prices;

CREATE POLICY "Cashiers can insert customer product prices" ON customer_product_prices
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'cashier'));

CREATE POLICY "Cashiers can update customer product prices" ON customer_product_prices
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'cashier'));

CREATE POLICY "Cashiers can delete customer product prices" ON customer_product_prices
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'cashier'));

-- Expenses: Add cashier update and delete access
DROP POLICY IF EXISTS "Cashiers can update expenses" ON expenses;
DROP POLICY IF EXISTS "Cashiers can delete expenses" ON expenses;

CREATE POLICY "Cashiers can update expenses" ON expenses
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'cashier'));

CREATE POLICY "Cashiers can delete expenses" ON expenses
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'cashier'));

-- Journal entries: Add cashier full access
DROP POLICY IF EXISTS "Cashiers can insert journal entries" ON journal_entries;
DROP POLICY IF EXISTS "Cashiers can update journal entries" ON journal_entries;
DROP POLICY IF EXISTS "Cashiers can delete journal entries" ON journal_entries;

CREATE POLICY "Cashiers can insert journal entries" ON journal_entries
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'cashier'));

CREATE POLICY "Cashiers can update journal entries" ON journal_entries
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'cashier'));

CREATE POLICY "Cashiers can delete journal entries" ON journal_entries
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'cashier'));

-- Journal entry lines: Add cashier full access
DROP POLICY IF EXISTS "Cashiers can insert journal entry lines" ON journal_entry_lines;
DROP POLICY IF EXISTS "Cashiers can update journal entry lines" ON journal_entry_lines;
DROP POLICY IF EXISTS "Cashiers can delete journal entry lines" ON journal_entry_lines;

CREATE POLICY "Cashiers can insert journal entry lines" ON journal_entry_lines
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'cashier'));

CREATE POLICY "Cashiers can update journal entry lines" ON journal_entry_lines
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'cashier'));

CREATE POLICY "Cashiers can delete journal entry lines" ON journal_entry_lines
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'cashier'));

-- Offers: Add cashier full access
DROP POLICY IF EXISTS "Cashiers can insert offers" ON offers;
DROP POLICY IF EXISTS "Cashiers can update offers" ON offers;
DROP POLICY IF EXISTS "Cashiers can delete offers" ON offers;

CREATE POLICY "Cashiers can insert offers" ON offers
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'cashier'));

CREATE POLICY "Cashiers can update offers" ON offers
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'cashier'));

CREATE POLICY "Cashiers can delete offers" ON offers
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'cashier'));

-- Orders: Add cashier delete access and remove restrictions on update
DROP POLICY IF EXISTS "Cashiers can delete orders" ON orders;
DROP POLICY IF EXISTS "Cashiers can update orders" ON orders;

CREATE POLICY "Cashiers can delete orders" ON orders
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'cashier'));

CREATE POLICY "Cashiers can update orders" ON orders
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'cashier'));

-- Payment receipts: Add cashier update access (no delete policy exists)
DROP POLICY IF EXISTS "Cashiers can update payment receipts" ON payment_receipts;

CREATE POLICY "Cashiers can update payment receipts" ON payment_receipts
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'cashier'));

-- Product variants: Add cashier insert and delete access
DROP POLICY IF EXISTS "Cashiers can insert product variants" ON product_variants;
DROP POLICY IF EXISTS "Cashiers can delete product variants" ON product_variants;

CREATE POLICY "Cashiers can insert product variants" ON product_variants
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'cashier'));

CREATE POLICY "Cashiers can delete product variants" ON product_variants
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'cashier'));

-- Products: Add cashier insert and delete access
DROP POLICY IF EXISTS "Cashiers can insert products" ON products;
DROP POLICY IF EXISTS "Cashiers can delete products" ON products;

CREATE POLICY "Cashiers can insert products" ON products
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'cashier'));

CREATE POLICY "Cashiers can delete products" ON products
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'cashier'));