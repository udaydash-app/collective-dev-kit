-- Delete all products first (due to foreign key constraints)
DELETE FROM cart_items;
DELETE FROM order_items;
DELETE FROM favorites;
DELETE FROM wishlist;
DELETE FROM products;

-- Delete all categories
DELETE FROM categories;