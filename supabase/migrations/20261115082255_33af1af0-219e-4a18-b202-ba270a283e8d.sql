CREATE OR REPLACE FUNCTION public.delete_payment_receipt(p_receipt_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_receipt_number text;
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

  -- Remove the related journal entry (lines cascade)
  DELETE FROM public.journal_entries WHERE reference = v_receipt_number;

  DELETE FROM public.payment_receipts WHERE id = p_receipt_id;

  RETURN v_receipt_number;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_payment_receipt(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_payment_receipt(uuid) TO authenticated, service_role;