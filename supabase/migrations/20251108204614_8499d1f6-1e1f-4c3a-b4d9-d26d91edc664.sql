-- Fix opening balance for INDIAN BAZAAR to achieve target balance of 1,041,700
UPDATE contacts
SET opening_balance = 951000
WHERE name ILIKE '%INDIAN%BAZAAR%';

-- Recalculate account balance for INDIAN BAZAAR customer account
UPDATE accounts
SET current_balance = (
  SELECT 
    COALESCE((SELECT opening_balance FROM contacts WHERE name ILIKE '%INDIAN%BAZAAR%'), 0) +
    COALESCE(SUM(jel.debit_amount), 0) - COALESCE(SUM(jel.credit_amount), 0)
  FROM journal_entry_lines jel
  WHERE jel.account_id = accounts.id
)
WHERE account_name ILIKE '%INDIAN%BAZAAR%Customer%';