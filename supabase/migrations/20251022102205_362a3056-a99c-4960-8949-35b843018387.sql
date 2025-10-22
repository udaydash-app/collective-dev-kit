-- Enable full replica identity for orders table to support real-time updates
ALTER TABLE public.orders REPLICA IDENTITY FULL;