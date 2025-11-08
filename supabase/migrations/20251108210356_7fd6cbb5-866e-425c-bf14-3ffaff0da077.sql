-- Delete old opening balance entry
DELETE FROM journal_entries 
WHERE reference LIKE 'OB-CUST-%' 
  AND description LIKE '%INDIAN BAZAAR%';

-- Update opening balance to get final balance of 3,700
-- Operational net: -1,362,300
-- Required opening: 3,700 - (-1,362,300) = 1,366,000

UPDATE contacts
SET opening_balance = 1366000
WHERE name ILIKE '%INDIAN%BAZAAR%';

-- The trigger will create new opening balance journal entry automatically