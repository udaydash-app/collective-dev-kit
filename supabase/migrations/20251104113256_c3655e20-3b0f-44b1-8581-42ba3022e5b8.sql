-- Update RLS policies to allow users to edit and delete auto-generated journals

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can update their own draft journal entries" ON public.journal_entries;
DROP POLICY IF EXISTS "Users can delete their own draft journal entries" ON public.journal_entries;
DROP POLICY IF EXISTS "Users can insert their own journal entry lines" ON public.journal_entry_lines;
DROP POLICY IF EXISTS "Users can update their own journal entry lines" ON public.journal_entry_lines;
DROP POLICY IF EXISTS "Users can delete their own journal entry lines" ON public.journal_entry_lines;

-- Create new policies without draft restriction for user's own journals
CREATE POLICY "Users can update their own journal entries"
ON public.journal_entries
FOR UPDATE
TO authenticated
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can delete their own journal entries"
ON public.journal_entries
FOR DELETE
TO authenticated
USING (created_by = auth.uid());

-- Update journal_entry_lines policies to match
CREATE POLICY "Users can insert their own journal entry lines"
ON public.journal_entry_lines
FOR INSERT
TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM journal_entries je
  WHERE je.id = journal_entry_lines.journal_entry_id
  AND je.created_by = auth.uid()
));

CREATE POLICY "Users can update their own journal entry lines"
ON public.journal_entry_lines
FOR UPDATE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM journal_entries je
  WHERE je.id = journal_entry_lines.journal_entry_id
  AND je.created_by = auth.uid()
));

CREATE POLICY "Users can delete their own journal entry lines"
ON public.journal_entry_lines
FOR DELETE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM journal_entries je
  WHERE je.id = journal_entry_lines.journal_entry_id
  AND je.created_by = auth.uid()
));