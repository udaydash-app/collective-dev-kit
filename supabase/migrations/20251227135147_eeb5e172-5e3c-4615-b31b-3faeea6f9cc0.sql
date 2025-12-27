-- Update existing cash_sessions to use pos_users.id instead of auth user_id
-- First, update sessions where cashier_id is actually an auth user_id
UPDATE cash_sessions cs
SET cashier_id = pu.id
FROM pos_users pu
WHERE cs.cashier_id = pu.user_id
  AND pu.user_id IS NOT NULL;

-- Add a comment explaining the column usage
COMMENT ON COLUMN cash_sessions.cashier_id IS 'References pos_users.id (not auth.users.id)';