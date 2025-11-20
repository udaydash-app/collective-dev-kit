-- Fix duplicate trigger causing double stock deduction on purchase delete
-- Remove the duplicate BEFORE DELETE trigger, keep only the AFTER DELETE one

DROP TRIGGER IF EXISTS reverse_stock_on_purchase_item_delete ON purchase_items;

-- The AFTER DELETE trigger (reverse_stock_on_purchase_delete_trigger) will remain
-- This trigger correctly reverses stock when a purchase is deleted