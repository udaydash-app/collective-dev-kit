-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS payment_receipt_journal_entry_trigger ON public.payment_receipts;

-- Create trigger for INSERT, UPDATE, and DELETE operations
CREATE TRIGGER payment_receipt_journal_entry_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.payment_receipts
FOR EACH ROW
EXECUTE FUNCTION public.create_payment_receipt_journal_entry();