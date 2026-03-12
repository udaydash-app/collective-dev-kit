
-- Delete overage journal entry lines for March 10 and March 11 (no actual difference existed)
DELETE FROM journal_entry_lines
WHERE journal_entry_id IN (
  '61ac4dc4-1e91-455d-a39a-939474139c67',
  '7502f0d1-34d8-418d-88e2-0dad18ef4351'
);

-- Delete the overage journal entries themselves
DELETE FROM journal_entries
WHERE id IN (
  '61ac4dc4-1e91-455d-a39a-939474139c67',
  '7502f0d1-34d8-418d-88e2-0dad18ef4351'
);
