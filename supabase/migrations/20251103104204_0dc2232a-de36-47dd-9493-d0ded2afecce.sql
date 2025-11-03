-- Add customer_id column to pos_transactions table to link POS sales to customers
ALTER TABLE pos_transactions 
ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES contacts(id);