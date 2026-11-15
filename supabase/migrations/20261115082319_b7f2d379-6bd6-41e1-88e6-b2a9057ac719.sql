CREATE OR REPLACE FUNCTION public.delete_payment_receipt(p_receipt_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_receipt_number text;
  v_count integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not signed in — please log in again with your PIN';
  END IF;

  IF NOT (public.has_role(v_uid, 'admin'::app_role) OR public.has_role(v_uid, 'cashier'::app_role)) THEN
    RAISE EXCEPTION 'You do not have permission to delete payment receipts';
  END IF;

  SELECT receipt_number INTO v_receipt_number
  FROM public.payment_receipts WHERE id = p_receipt_id;

  IF v_receipt_number IS NULL THEN
    RAISE EXCEPTION 'Payment receipt not found (it may already be deleted)';
  END IF;

  -- The payment_receipt_journal_entry_trigger removes the related journal entry
  DELETE FROM public.payment_receipts WHERE id = p_receipt_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count = 0 THEN
    RAISE EXCEPTION 'Payment receipt % could not be deleted (permission denied)', v_receipt_number;
  END IF;

  RETURN v_receipt_number;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_payment_receipt(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_payment_receipt(uuid) TO authenticated, service_role;