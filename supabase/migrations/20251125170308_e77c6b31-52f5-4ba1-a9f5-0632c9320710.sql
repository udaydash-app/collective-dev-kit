-- Add payment_method column to orders table for storing payment method when completing online orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_method text;