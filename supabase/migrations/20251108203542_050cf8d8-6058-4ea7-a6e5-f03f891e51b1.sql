-- Function to reverse journal entries for a transaction reference
CREATE OR REPLACE FUNCTION reverse_transaction_journal_entries(p_reference TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete all journal entry lines for this reference
  DELETE FROM journal_entry_lines jel
  USING journal_entries je
  WHERE jel.journal_entry_id = je.id
    AND je.reference = p_reference;
  
  -- Delete the journal entries themselves
  DELETE FROM journal_entries
  WHERE reference = p_reference;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION reverse_transaction_journal_entries(TEXT) TO authenticated, service_role;