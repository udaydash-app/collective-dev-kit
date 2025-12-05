-- Fix addresses table RLS policies
-- Remove the redundant "Deny anonymous access" policy (RLS is already enabled, and we have proper user-based policies)
DROP POLICY IF EXISTS "Deny anonymous access to addresses" ON public.addresses;

-- Add admin INSERT policy
CREATE POLICY "Admins can insert addresses" 
ON public.addresses 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Add admin UPDATE policy
CREATE POLICY "Admins can update all addresses" 
ON public.addresses 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add admin DELETE policy
CREATE POLICY "Admins can delete all addresses" 
ON public.addresses 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add cashier policies for full access
CREATE POLICY "Cashiers can view all addresses" 
ON public.addresses 
FOR SELECT 
USING (has_role(auth.uid(), 'cashier'::app_role));

CREATE POLICY "Cashiers can insert addresses" 
ON public.addresses 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'cashier'::app_role));

CREATE POLICY "Cashiers can update addresses" 
ON public.addresses 
FOR UPDATE 
USING (has_role(auth.uid(), 'cashier'::app_role));

CREATE POLICY "Cashiers can delete addresses" 
ON public.addresses 
FOR DELETE 
USING (has_role(auth.uid(), 'cashier'::app_role));