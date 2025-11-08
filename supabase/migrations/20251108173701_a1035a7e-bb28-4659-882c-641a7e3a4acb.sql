-- Delete all journal entries related to purchases
DELETE FROM journal_entries 
WHERE reference IN (SELECT purchase_number FROM purchases);

-- Update all purchases to pending status
UPDATE purchases 
SET 
  payment_status = 'pending',
  updated_at = NOW()
WHERE payment_status != 'pending';

-- The trigger will automatically create new journal entries with correct accounts payable entries