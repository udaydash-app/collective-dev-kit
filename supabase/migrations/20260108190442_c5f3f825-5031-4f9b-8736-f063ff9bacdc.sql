-- Drop duplicate trigger that's causing double stock updates on purchase item insert
-- Keep only update_stock_on_purchase_trigger which is the standard one from local-db-setup.sql

DROP TRIGGER IF EXISTS update_stock_on_purchase_item_insert_trigger ON public.purchase_items;