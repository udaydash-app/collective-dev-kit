-- Add amount_paid column to pos_transactions table for tracking payments on credit sales
ALTER TABLE pos_transactions ADD COLUMN IF NOT EXISTS amount_paid NUMERIC DEFAULT 0;