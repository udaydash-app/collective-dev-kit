-- Insert sample store
INSERT INTO stores (name, address, city, state, zip_code, phone, hours, is_active)
VALUES (
  'Global Market Downtown',
  '123 Main Street',
  'New York',
  'NY',
  '10001',
  '+1-555-0123',
  'Mon-Sun: 8:00 AM - 10:00 PM',
  true
);

-- Get the store_id for later use
DO $$
DECLARE
  store_uuid uuid;
  fresh_produce_id uuid;
  dairy_id uuid;
  bakery_id uuid;
BEGIN
  -- Get the store ID
  SELECT id INTO store_uuid FROM stores LIMIT 1;

  -- Insert categories
  INSERT INTO categories (name, slug, description, icon, is_active) VALUES
  ('Fresh Produce', 'fresh-produce', 'Fresh fruits and vegetables', '🥬', true)
  RETURNING id INTO fresh_produce_id;

  INSERT INTO categories (name, slug, description, icon, is_active) VALUES
  ('Dairy & Eggs', 'dairy-eggs', 'Milk, cheese, eggs and more', '🥛', true)
  RETURNING id INTO dairy_id;

  INSERT INTO categories (name, slug, description, icon, is_active) VALUES
  ('Bakery', 'bakery', 'Fresh bread and baked goods', '🍞', true)
  RETURNING id INTO bakery_id;

  -- Insert products for Fresh Produce
  INSERT INTO products (store_id, category_id, name, description, price, unit, image_url, is_available, stock_quantity, is_featured) VALUES
  (store_uuid, fresh_produce_id, 'Organic Bananas', 'Fresh organic bananas, perfect for snacking or adding to smoothies. Rich in potassium and natural energy.', 2.99, 'per bunch', '🍌', true, 100, true),
  (store_uuid, fresh_produce_id, 'Fresh Strawberries', 'Sweet and juicy strawberries, locally sourced when in season.', 4.99, 'per lb', '🍓', true, 50, true),
  (store_uuid, fresh_produce_id, 'Green Apples', 'Crisp and tart green apples, perfect for snacking or baking.', 3.49, 'per lb', '🍏', true, 75, false),
  (store_uuid, fresh_produce_id, 'Blueberries', 'Plump and sweet blueberries, packed with antioxidants.', 5.99, 'per pint', '🫐', true, 40, true),
  (store_uuid, fresh_produce_id, 'Cherry Tomatoes', 'Sweet cherry tomatoes, perfect for salads and snacking.', 3.99, 'per container', '🍅', true, 60, false),
  (store_uuid, fresh_produce_id, 'Fresh Avocados', 'Ripe avocados, ready to eat. Great for toast, salads, and guacamole.', 1.99, 'each', '🥑', true, 80, true);

  -- Insert products for Dairy & Eggs
  INSERT INTO products (store_id, category_id, name, description, price, unit, image_url, is_available, stock_quantity) VALUES
  (store_uuid, dairy_id, 'Organic Whole Milk', 'Fresh organic whole milk from local farms.', 4.49, 'per gallon', '🥛', true, 30),
  (store_uuid, dairy_id, 'Greek Yogurt', 'Creamy Greek yogurt, high in protein.', 5.99, 'per 32oz', '🥄', true, 45),
  (store_uuid, dairy_id, 'Free Range Eggs', 'Farm fresh free range eggs, one dozen.', 6.99, 'per dozen', '🥚', true, 50),
  (store_uuid, dairy_id, 'Cheddar Cheese', 'Sharp cheddar cheese, perfect for sandwiches.', 7.49, 'per lb', '🧀', true, 35);

  -- Insert products for Bakery
  INSERT INTO products (store_id, category_id, name, description, price, unit, image_url, is_available, stock_quantity) VALUES
  (store_uuid, bakery_id, 'Sourdough Bread', 'Artisan sourdough bread, baked fresh daily.', 5.99, 'per loaf', '🍞', true, 25),
  (store_uuid, bakery_id, 'Croissants', 'Buttery and flaky croissants, baked fresh daily.', 3.99, 'per pack of 4', '🥐', true, 20),
  (store_uuid, bakery_id, 'Blueberry Muffins', 'Fresh blueberry muffins, perfect for breakfast.', 4.99, 'per pack of 6', '🧁', true, 30);
END $$;