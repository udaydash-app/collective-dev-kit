CREATE OR REPLACE FUNCTION public.get_ledger_balances(account_ids uuid[])
RETURNS TABLE(account_id uuid, balance numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH mov AS (
    SELECT l.account_id,
           COALESCE(SUM(l.debit_amount), 0) AS d,
           COALESCE(SUM(l.credit_amount), 0) AS c
    FROM journal_entry_lines l
    JOIN journal_entries e ON e.id = l.journal_entry_id
    WHERE e.status = 'posted'
      AND l.account_id = ANY(account_ids)
      AND COALESCE(e.description, '') NOT ILIKE '%opening balance%'
    GROUP BY l.account_id
  ),
  contact_open AS (
    -- Customer ledger opening from contacts.opening_balance
    SELECT c.customer_ledger_account_id AS account_id,
           COALESCE(c.opening_balance, 0) AS opening
    FROM contacts c
    WHERE c.customer_ledger_account_id = ANY(account_ids)
    UNION ALL
    -- Supplier ledger opening from contacts.supplier_opening_balance
    SELECT c.supplier_ledger_account_id AS account_id,
           COALESCE(c.supplier_opening_balance, 0) AS opening
    FROM contacts c
    WHERE c.supplier_ledger_account_id = ANY(account_ids)
  )
  SELECT a.id AS account_id,
         COALESCE(co.opening, a.opening_balance, 0)
           + CASE WHEN a.account_type IN ('asset','expense')
                  THEN (COALESCE(m.d,0) - COALESCE(m.c,0))
                  ELSE (COALESCE(m.c,0) - COALESCE(m.d,0))
             END AS balance
  FROM accounts a
  LEFT JOIN mov m ON m.account_id = a.id
  LEFT JOIN contact_open co ON co.account_id = a.id
  WHERE a.id = ANY(account_ids);
$function$;