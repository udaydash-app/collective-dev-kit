-- Allow POS users to have their cashier role created during login
-- This is a one-time operation that happens after authentication succeeds

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Only admins can manage roles" ON user_roles;

-- Create separate policies for different operations
CREATE POLICY "Admins can manage all roles"
ON user_roles
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Allow authenticated users to insert their own cashier role (for POS login)
CREATE POLICY "Users can create their own cashier role"
ON user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id 
  AND role = 'cashier'::app_role
);