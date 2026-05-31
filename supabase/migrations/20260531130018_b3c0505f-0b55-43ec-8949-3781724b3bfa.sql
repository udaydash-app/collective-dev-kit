INSERT INTO restaurant_tables (name, seats, shape, status) VALUES
('T1', 2, 'square', 'free'),
('T2', 4, 'square', 'free'),
('T3', 4, 'round', 'free'),
('T4', 6, 'round', 'free'),
('T5', 2, 'square', 'free'),
('T6', 8, 'square', 'free'),
('B1', 1, 'square', 'free'),
('B2', 1, 'square', 'free')
ON CONFLICT DO NOTHING;

INSERT INTO restaurant_menu_categories (name, sort_order, color, is_active) VALUES
('Starters', 1, '#f59e0b', true),
('Main Course', 2, '#ef4444', true),
('Pizza', 3, '#dc2626', true),
('Burgers', 4, '#d97706', true),
('Beverages', 5, '#0ea5e9', true),
('Desserts', 6, '#ec4899', true)
ON CONFLICT DO NOTHING;

DO $$
DECLARE
  c_start uuid; c_main uuid; c_pizza uuid; c_burg uuid; c_bev uuid; c_des uuid;
BEGIN
  SELECT id INTO c_start FROM restaurant_menu_categories WHERE name='Starters' LIMIT 1;
  SELECT id INTO c_main FROM restaurant_menu_categories WHERE name='Main Course' LIMIT 1;
  SELECT id INTO c_pizza FROM restaurant_menu_categories WHERE name='Pizza' LIMIT 1;
  SELECT id INTO c_burg FROM restaurant_menu_categories WHERE name='Burgers' LIMIT 1;
  SELECT id INTO c_bev FROM restaurant_menu_categories WHERE name='Beverages' LIMIT 1;
  SELECT id INTO c_des FROM restaurant_menu_categories WHERE name='Desserts' LIMIT 1;

  INSERT INTO restaurant_menu_items (category_id, name, price, kot_printer, is_available, sort_order) VALUES
  (c_start, 'Spring Rolls', 2500, 'kitchen', true, 1),
  (c_start, 'Chicken Wings', 3500, 'kitchen', true, 2),
  (c_start, 'Garlic Bread', 1500, 'kitchen', true, 3),
  (c_start, 'Soup of the Day', 2000, 'kitchen', true, 4),
  (c_main, 'Grilled Chicken', 6500, 'kitchen', true, 1),
  (c_main, 'Beef Steak', 9500, 'kitchen', true, 2),
  (c_main, 'Fish & Chips', 5500, 'kitchen', true, 3),
  (c_main, 'Pasta Alfredo', 4500, 'kitchen', true, 4),
  (c_main, 'Vegetable Curry', 3500, 'kitchen', true, 5),
  (c_pizza, 'Margherita', 4000, 'kitchen', true, 1),
  (c_pizza, 'Pepperoni', 5000, 'kitchen', true, 2),
  (c_pizza, 'Quattro Formaggi', 5500, 'kitchen', true, 3),
  (c_pizza, 'Veggie Supreme', 4500, 'kitchen', true, 4),
  (c_burg, 'Classic Burger', 3500, 'kitchen', true, 1),
  (c_burg, 'Cheese Burger', 4000, 'kitchen', true, 2),
  (c_burg, 'Double Bacon', 5000, 'kitchen', true, 3),
  (c_burg, 'Veggie Burger', 3000, 'kitchen', true, 4),
  (c_bev, 'Coca-Cola', 1000, 'bar', true, 1),
  (c_bev, 'Fresh Juice', 1500, 'bar', true, 2),
  (c_bev, 'Coffee', 1200, 'bar', true, 3),
  (c_bev, 'Mineral Water', 800, 'bar', true, 4),
  (c_bev, 'Beer', 2000, 'bar', true, 5),
  (c_des, 'Chocolate Cake', 2500, 'kitchen', true, 1),
  (c_des, 'Ice Cream', 1800, 'kitchen', true, 2),
  (c_des, 'Tiramisu', 3000, 'kitchen', true, 3),
  (c_des, 'Fruit Salad', 2000, 'kitchen', true, 4)
  ON CONFLICT DO NOTHING;
END $$;