-- Add DELETE policy for admins on orders table
CREATE POLICY "Admins can delete orders"
ON public.orders
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'::app_role
  )
);