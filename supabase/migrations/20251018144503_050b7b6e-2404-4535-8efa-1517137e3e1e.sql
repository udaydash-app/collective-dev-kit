-- Allow admins to view all categories (including inactive)
CREATE POLICY "Admins can view all categories"
ON public.categories
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to update categories
CREATE POLICY "Admins can update categories"
ON public.categories
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to insert categories
CREATE POLICY "Admins can insert categories"
ON public.categories
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete categories
CREATE POLICY "Admins can delete categories"
ON public.categories
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));