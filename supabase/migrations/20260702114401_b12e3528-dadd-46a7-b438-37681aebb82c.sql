
-- Fiscal period toggle + opening balance support
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS incorporation_date DATE NOT NULL DEFAULT '2026-07-01',
  ADD COLUMN IF NOT EXISTS active_period TEXT NOT NULL DEFAULT 'current' CHECK (active_period IN ('current','before'));

ALTER TABLE public.journal_entries
  ADD COLUMN IF NOT EXISTS is_opening BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS journal_entries_opening_reference_key
  ON public.journal_entries (reference) WHERE is_opening = true;

-- RPC to (re)generate opening balances as of the day before the incorporation date
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
  IF NOT (public.is_active_pos_accounting_user() OR auth.role() = 'service_role') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Wipe any prior opening entry for this cutoff
  DELETE FROM public.journal_entries WHERE reference = v_ref AND is_opening = true;

  -- Create the shell entry
  INSERT INTO public.journal_entries (entry_date, reference, description, status, is_opening)
  VALUES (p_cutoff, v_ref, 'Opening Balance as of ' || to_char(p_cutoff + 1, 'DD/MM/YYYY'), 'posted', true)
  RETURNING id INTO v_entry_id;

  -- Sum prior net per account (excluding any existing opening entries to avoid double count)
  INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
  SELECT v_entry_id, x.account_id,
         GREATEST(x.net, 0) AS debit,
         GREATEST(-x.net, 0) AS credit,
         'Opening balance'
  FROM (
    SELECT jel.account_id, SUM(COALESCE(jel.debit,0) - COALESCE(jel.credit,0)) AS net
    FROM public.journal_entry_lines jel
    JOIN public.journal_entries je ON je.id = jel.journal_entry_id
    WHERE je.entry_date <= p_cutoff
      AND je.status = 'posted'
      AND COALESCE(je.is_opening, false) = false
    GROUP BY jel.account_id
    HAVING ABS(SUM(COALESCE(jel.debit,0) - COALESCE(jel.credit,0))) > 0.005
  ) x;

  GET DIAGNOSTICS v_lines = ROW_COUNT;

  -- Balance to retained earnings (1301 preferred, else 1101, else create 1301)
  SELECT id INTO v_retained FROM public.accounts WHERE code = '1301' LIMIT 1;
  IF v_retained IS NULL THEN
    SELECT id INTO v_retained FROM public.accounts WHERE code = '1101' LIMIT 1;
  END IF;
  IF v_retained IS NULL THEN
    INSERT INTO public.accounts (code, name, type, is_active)
    VALUES ('1301', 'Retained Earnings', 'equity', true)
    RETURNING id INTO v_retained;
  END IF;

  SELECT COALESCE(SUM(debit),0) - COALESCE(SUM(credit),0)
    INTO v_diff
    FROM public.journal_entry_lines WHERE journal_entry_id = v_entry_id;

  IF ABS(v_diff) > 0.005 THEN
    INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
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

GRANT EXECUTE ON FUNCTION public.generate_opening_balances(DATE) TO authenticated, service_role;
