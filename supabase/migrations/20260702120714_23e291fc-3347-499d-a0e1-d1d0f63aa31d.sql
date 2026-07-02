CREATE OR REPLACE FUNCTION public.generate_opening_balances(p_cutoff DATE)
RETURNS TABLE(entry_id UUID, lines_created INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref TEXT := 'OPENING-' || to_char(p_cutoff + 1, 'YYYY-MM-DD');
  v_entry_id UUID;
  v_lines INT;
  v_retained UUID;
  v_diff NUMERIC;
BEGIN
  IF auth.role() <> 'service_role'
     AND (auth.uid() IS NULL OR NOT public.is_active_pos_accounting_user(auth.uid()))
     AND auth.role() NOT IN ('anon','authenticated') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  DELETE FROM public.journal_entries WHERE reference = v_ref AND is_opening = true;

  INSERT INTO public.journal_entries (entry_date, reference, description, status, is_opening)
  VALUES (p_cutoff, v_ref, 'Opening Balance as of ' || to_char(p_cutoff + 1, 'DD/MM/YYYY'), 'posted', true)
  RETURNING id INTO v_entry_id;

  INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description)
  SELECT v_entry_id, x.account_id,
         GREATEST(x.net, 0),
         GREATEST(-x.net, 0),
         'Opening balance'
  FROM (
    SELECT jel.account_id, SUM(COALESCE(jel.debit_amount,0) - COALESCE(jel.credit_amount,0)) AS net
    FROM public.journal_entry_lines jel
    JOIN public.journal_entries je ON je.id = jel.journal_entry_id
    WHERE je.entry_date <= p_cutoff
      AND je.status = 'posted'
      AND COALESCE(je.is_opening, false) = false
    GROUP BY jel.account_id
    HAVING ABS(SUM(COALESCE(jel.debit_amount,0) - COALESCE(jel.credit_amount,0))) > 0.005
  ) x;

  GET DIAGNOSTICS v_lines = ROW_COUNT;

  SELECT id INTO v_retained FROM public.accounts WHERE account_code = '1301' LIMIT 1;
  IF v_retained IS NULL THEN
    SELECT id INTO v_retained FROM public.accounts WHERE account_code = '1101' LIMIT 1;
  END IF;
  IF v_retained IS NULL THEN
    INSERT INTO public.accounts (account_code, account_name, account_type, is_active)
    VALUES ('1301', 'Retained Earnings', 'equity', true)
    RETURNING id INTO v_retained;
  END IF;

  SELECT COALESCE(SUM(debit_amount),0) - COALESCE(SUM(credit_amount),0)
    INTO v_diff
    FROM public.journal_entry_lines WHERE journal_entry_id = v_entry_id;

  IF ABS(v_diff) > 0.005 THEN
    INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description)
    VALUES (
      v_entry_id, v_retained,
      CASE WHEN v_diff < 0 THEN -v_diff ELSE 0 END,
      CASE WHEN v_diff > 0 THEN v_diff ELSE 0 END,
      'Retained earnings (opening balancing)'
    );
    v_lines := v_lines + 1;
  END IF;

  RETURN QUERY SELECT v_entry_id, v_lines;
END;
$$;