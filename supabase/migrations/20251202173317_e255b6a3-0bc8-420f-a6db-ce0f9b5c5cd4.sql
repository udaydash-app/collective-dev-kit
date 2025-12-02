-- Set is_available_online based on is_available status
UPDATE products SET is_available_online = true WHERE is_available = true;
UPDATE products SET is_available_online = false WHERE is_available = false;