
-- Drop the trigger and function that creates duplicate PUR-XXX-PMT journal entries.
-- The supplier_payment trigger (create_supplier_payment_journal_entry) already handles
-- all payment journaling correctly via SPM-XXXXX references.

DROP TRIGGER IF EXISTS purchase_payment_update_trigger ON purchases;
DROP FUNCTION IF EXISTS public.handle_purchase_payment_update();

-- Clean up the existing duplicate PUR-45EABDE328-PMT entry
DELETE FROM journal_entries WHERE reference = 'PUR-45EABDE328-PMT';

-- Also clean up any other -PMT duplicate entries that may have been created
DELETE FROM journal_entries
WHERE reference LIKE '%-PMT'
  AND description LIKE 'Paiement achat -%';
