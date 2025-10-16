-- Fix profiles table RLS policies to prevent cross-user data access

-- Drop the confusing "Deny anonymous access" policy that may interfere with proper access control
DROP POLICY IF EXISTS "Deny anonymous access to profiles" ON public.profiles;

-- The existing "Users can view their own profile" policy already restricts SELECT properly
-- But let's ensure it's correct by recreating it
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (auth.uid() = id);

-- Keep the existing update and insert policies as they are already correct
-- They already ensure users can only modify their own profiles