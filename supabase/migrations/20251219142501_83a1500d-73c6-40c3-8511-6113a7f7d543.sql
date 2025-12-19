-- Update remaining expense accounts to SYSCOHADA
UPDATE accounts SET account_code = '62', account_name = 'Services extérieurs A' 
WHERE account_code = '5200';

UPDATE accounts SET account_code = '622', account_name = 'Locations et charges locatives' 
WHERE account_code = '5210';

UPDATE accounts SET account_code = '6061', account_name = 'Eau et électricité' 
WHERE account_code = '5220';

UPDATE accounts SET account_code = '641', account_name = 'Rémunérations du personnel' 
WHERE account_code = '5230';

UPDATE accounts SET account_code = '6271', account_name = 'Publicité et annonces' 
WHERE account_code = '5240';

UPDATE accounts SET account_code = '6064', account_name = 'Fournitures de bureau' 
WHERE account_code = '5250';

UPDATE accounts SET account_code = '625', account_name = 'Primes d''assurance' 
WHERE account_code = '5260';

UPDATE accounts SET account_code = '681', account_name = 'Dotations aux amortissements' 
WHERE account_code = '5270';

UPDATE accounts SET account_code = '631', account_name = 'Frais bancaires' 
WHERE account_code = '5280';

UPDATE accounts SET account_code = '658', account_name = 'Charges diverses' 
WHERE account_code = '5290';

-- Update Other Income
UPDATE accounts SET account_code = '771', account_name = 'Produits exceptionnels' 
WHERE account_code = '4200';

-- Update personal accounts to proper owner drawing sub-accounts
UPDATE accounts SET account_code = '1091', account_name = 'THOTO AUBIN (Prélèvements)' 
WHERE account_code = '9000';

UPDATE accounts SET account_code = '1092', account_name = 'DEVANG PERSONAL (Prélèvements)' 
WHERE account_code = '9001';

-- Delete the old bank sub-account if not needed
DELETE FROM accounts WHERE account_code = '5211' AND current_balance = 0;