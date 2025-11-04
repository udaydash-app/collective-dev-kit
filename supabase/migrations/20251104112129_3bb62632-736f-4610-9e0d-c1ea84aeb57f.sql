
-- Add RLS policies for users to edit and delete their own journal entries

-- Allow users to view journal entries they created
CREATE POLICY "Users can view their own journal entries"
ON public.journal_entries
FOR SELECT
TO authenticated
USING (created_by = auth.uid());

-- Allow users to update journal entries they created (only if status is draft)
CREATE POLICY "Users can update their own draft journal entries"
ON public.journal_entries
FOR UPDATE
TO authenticated
USING (created_by = auth.uid() AND status = 'draft')
WITH CHECK (created_by = auth.uid() AND status = 'draft');

-- Allow users to delete journal entries they created (only if status is draft)
CREATE POLICY "Users can delete their own draft journal entries"
ON public.journal_entries
FOR DELETE
TO authenticated
USING (created_by = auth.uid() AND status = 'draft');

-- Add corresponding policies for journal_entry_lines

-- Allow users to view journal entry lines for their own journal entries
CREATE POLICY "Users can view their own journal entry lines"
ON public.journal_entry_lines
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM journal_entries je
  WHERE je.id = journal_entry_lines.journal_entry_id
  AND je.created_by = auth.uid()
));

-- Allow users to insert journal entry lines for their own draft journal entries
CREATE POLICY "Users can insert their own journal entry lines"
ON public.journal_entry_lines
FOR INSERT
TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM journal_entries je
  WHERE je.id = journal_entry_lines.journal_entry_id
  AND je.created_by = auth.uid()
  AND je.status = 'draft'
));

-- Allow users to update journal entry lines for their own draft journal entries
CREATE POLICY "Users can update their own journal entry lines"
ON public.journal_entry_lines
FOR UPDATE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM journal_entries je
  WHERE je.id = journal_entry_lines.journal_entry_id
  AND je.created_by = auth.uid()
  AND je.status = 'draft'
));

-- Allow users to delete journal entry lines for their own draft journal entries
CREATE POLICY "Users can delete their own journal entry lines"
ON public.journal_entry_lines
FOR DELETE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM journal_entries je
  WHERE je.id = journal_entry_lines.journal_entry_id
  AND je.created_by = auth.uid()
  AND je.status = 'draft'
));
