
-- Pause the per-line balance trigger while we copy history in bulk.
ALTER TABLE public.journal_entry_lines DISABLE TRIGGER USER;
ALTER TABLE public.journal_entries    DISABLE TRIGGER USER;

WITH src AS (
  SELECT je.*
    FROM journal_entries je
    LEFT JOIN journal_entries m
      ON m.masked_entry_id = je.id AND m.is_real_ledger = true
   WHERE (je.is_real_ledger IS NULL OR je.is_real_ledger = false)
     AND m.id IS NULL
),
ins AS (
  INSERT INTO journal_entries (
    description, entry_date, reference, total_debit, total_credit,
    transaction_amount, status, created_by, posted_by, posted_at,
    notes, is_real_ledger, masked_entry_id
  )
  SELECT description, entry_date, reference, total_debit, total_credit,
         transaction_amount, status, created_by, posted_by, posted_at,
         notes, true, id
    FROM src
  RETURNING id, masked_entry_id
)
INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
SELECT ins.id, jel.account_id, jel.description, jel.debit_amount, jel.credit_amount
  FROM ins
  JOIN journal_entry_lines jel ON jel.journal_entry_id = ins.masked_entry_id;

ALTER TABLE public.journal_entry_lines ENABLE TRIGGER USER;
ALTER TABLE public.journal_entries    ENABLE TRIGGER USER;
