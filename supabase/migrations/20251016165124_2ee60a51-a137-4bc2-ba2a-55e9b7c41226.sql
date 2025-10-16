-- Add phone number column to addresses table
ALTER TABLE addresses 
ADD COLUMN IF NOT EXISTS phone text;