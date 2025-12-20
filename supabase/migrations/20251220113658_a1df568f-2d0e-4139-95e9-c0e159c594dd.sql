-- Create trigger for deleting journal entries when POS transaction is deleted
CREATE OR REPLACE FUNCTION public.delete_pos_journal_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM journal_entries WHERE reference = OLD.transaction_number;
  RETURN OLD;
END;
$function$;

-- Create trigger for deleting journal entries when order is deleted
CREATE OR REPLACE FUNCTION public.delete_order_journal_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM journal_entries WHERE reference = OLD.order_number;
  RETURN OLD;
END;
$function$;

-- Create trigger on pos_transactions for DELETE
DROP TRIGGER IF EXISTS delete_pos_journal_entry_trigger ON pos_transactions;
CREATE TRIGGER delete_pos_journal_entry_trigger
  AFTER DELETE ON pos_transactions
  FOR EACH ROW
  EXECUTE FUNCTION delete_pos_journal_entry();

-- Create trigger on orders for DELETE
DROP TRIGGER IF EXISTS delete_order_journal_entry_trigger ON orders;
CREATE TRIGGER delete_order_journal_entry_trigger
  AFTER DELETE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION delete_order_journal_entry();