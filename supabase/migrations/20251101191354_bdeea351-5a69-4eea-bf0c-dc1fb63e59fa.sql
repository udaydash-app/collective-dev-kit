-- Drop existing policies if they exist, then recreate
DROP POLICY IF EXISTS "Cashiers can view products" ON products;
DROP POLICY IF EXISTS "Cashiers can view stores" ON stores;
DROP POLICY IF EXISTS "Cashiers can view all orders" ON orders;
DROP POLICY IF EXISTS "Cashiers can view contacts" ON contacts;
DROP POLICY IF EXISTS "Cashiers can view product variants" ON product_variants;
DROP POLICY IF EXISTS "Cashiers can view accounts" ON accounts;
DROP POLICY IF EXISTS "Cashiers can view journal entries" ON journal_entries;
DROP POLICY IF EXISTS "Cashiers can view journal entry lines" ON journal_entry_lines;
DROP POLICY IF EXISTS "Cashiers can view purchases" ON purchases;
DROP POLICY IF EXISTS "Cashiers can view purchase items" ON purchase_items;

-- Allow cashiers to view products (read-only)
CREATE POLICY "Cashiers can view products"
ON products
FOR SELECT
TO public
USING (has_role(auth.uid(), 'cashier'));

-- Allow cashiers to view stores (read-only)
CREATE POLICY "Cashiers can view stores"
ON stores
FOR SELECT
TO public
USING (has_role(auth.uid(), 'cashier'));

-- Allow cashiers to view all orders (for POS operations)
CREATE POLICY "Cashiers can view all orders"
ON orders
FOR SELECT
TO public
USING (has_role(auth.uid(), 'cashier'));

-- Allow cashiers to view contacts (for POS)
CREATE POLICY "Cashiers can view contacts"
ON contacts
FOR SELECT
TO public
USING (has_role(auth.uid(), 'cashier'));

-- Allow cashiers to view product variants
CREATE POLICY "Cashiers can view product variants"
ON product_variants
FOR SELECT
TO public
USING (has_role(auth.uid(), 'cashier'));

-- Allow cashiers to view accounts (read-only for reports)
CREATE POLICY "Cashiers can view accounts"
ON accounts
FOR SELECT
TO public
USING (has_role(auth.uid(), 'cashier'));

-- Allow cashiers to view journal entries (read-only for reports)
CREATE POLICY "Cashiers can view journal entries"
ON journal_entries
FOR SELECT
TO public
USING (has_role(auth.uid(), 'cashier'));

-- Allow cashiers to view journal entry lines (read-only for reports)
CREATE POLICY "Cashiers can view journal entry lines"
ON journal_entry_lines
FOR SELECT
TO public
USING (has_role(auth.uid(), 'cashier'));

-- Allow cashiers to view purchases (read-only)
CREATE POLICY "Cashiers can view purchases"
ON purchases
FOR SELECT
TO public
USING (has_role(auth.uid(), 'cashier'));

-- Allow cashiers to view purchase items (read-only)
CREATE POLICY "Cashiers can view purchase items"
ON purchase_items
FOR SELECT
TO public
USING (has_role(auth.uid(), 'cashier'));