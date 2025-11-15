
-- Drop the overly restrictive cashier insert policy
DROP POLICY IF EXISTS "Cashiers can insert stock adjustments" ON stock_adjustments;

-- Recreate it without the adjusted_by check (that field gets set by the app)
CREATE POLICY "Cashiers can insert stock adjustments"
ON stock_adjustments FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'cashier'::app_role));

-- Also add update and delete policies for cashiers that were missing
CREATE POLICY "Cashiers can update stock adjustments"
ON stock_adjustments FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'cashier'::app_role));

CREATE POLICY "Cashiers can delete stock adjustments"
ON stock_adjustments FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'cashier'::app_role));

-- Add same for admins (update and delete)
CREATE POLICY "Admins can update stock adjustments"
ON stock_adjustments FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete stock adjustments"
ON stock_adjustments FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
