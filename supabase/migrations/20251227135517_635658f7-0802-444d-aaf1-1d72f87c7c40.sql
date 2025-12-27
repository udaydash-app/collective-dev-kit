-- Update RLS policy to allow cashiers to view all open sessions at any store
-- This enables shared cash sessions across cashiers

-- Drop the restrictive cashier policy
DROP POLICY IF EXISTS "Cashiers can view own cash sessions" ON cash_sessions;

-- Create new policy allowing cashiers to view all sessions (for shared session feature)
CREATE POLICY "Cashiers can view all cash sessions" 
ON cash_sessions 
FOR SELECT 
USING (has_role(auth.uid(), 'cashier'::app_role));

-- Also update the cashier insert policy to not require cashier_id = auth.uid()
DROP POLICY IF EXISTS "Cashiers can insert own cash sessions" ON cash_sessions;

CREATE POLICY "Cashiers can insert cash sessions" 
ON cash_sessions 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'cashier'::app_role));

-- Update cashier update policy to allow updating any open session at their store
DROP POLICY IF EXISTS "Cashiers can update own open cash sessions" ON cash_sessions;

CREATE POLICY "Cashiers can update open cash sessions" 
ON cash_sessions 
FOR UPDATE 
USING (has_role(auth.uid(), 'cashier'::app_role) AND status = 'open');