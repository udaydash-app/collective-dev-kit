-- Update INDIAN BAZAAR opening balance to get correct final balance
-- Current journal net: -411,300
-- Desired final balance: 3,700
-- Required opening: 415,000

UPDATE contacts
SET opening_balance = 415000
WHERE name ILIKE '%INDIAN%BAZAAR%';

-- Update account balance to match
UPDATE accounts
SET current_balance = 3700
WHERE id = '68cdddd4-e7cc-4fde-94af-47aac7b55677';