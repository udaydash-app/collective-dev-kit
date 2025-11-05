-- Add metadata column to pos_transactions table
ALTER TABLE pos_transactions
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT NULL;