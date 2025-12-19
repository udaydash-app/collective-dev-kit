-- Update parent references first - point children to the SYSCOHADA equivalent
UPDATE accounts SET parent_account_id = (SELECT id FROM accounts WHERE account_code = '521' LIMIT 1)
WHERE parent_account_id = (SELECT id FROM accounts WHERE account_code = '1011' LIMIT 1);

-- Now we can safely delete or update duplicates
-- Update 1011 to 5211 (sub-account of 521) instead of deleting
UPDATE accounts SET account_code = '5211', account_name = 'Banques locales (ancien)'
WHERE account_code = '1011';

-- Delete 3100 if exists with 0 balance
DELETE FROM accounts WHERE account_code = '3100' AND current_balance = 0;

-- Update remaining old-code header/parent accounts
UPDATE accounts SET account_code = '2', account_name = 'Actif immobilisé' 
WHERE account_code = '1000';

UPDATE accounts SET account_code = '50', account_name = 'Valeurs mobilières de placement' 
WHERE account_code = '1100';

UPDATE accounts SET account_code = '476', account_name = 'Charges constatées d''avance' 
WHERE account_code = '1140';

UPDATE accounts SET account_code = '20', account_name = 'Immobilisations corporelles' 
WHERE account_code = '1200';

UPDATE accounts SET account_code = '241', account_name = 'Matériel et outillage' 
WHERE account_code = '1210';

UPDATE accounts SET account_code = '2435', account_name = 'Mobilier et matériel de bureau' 
WHERE account_code = '1220';

UPDATE accounts SET account_code = '244', account_name = 'Matériel de transport' 
WHERE account_code = '1230';

-- Liabilities
UPDATE accounts SET account_code = '19', account_name = 'Passif (dettes)' 
WHERE account_code = '2000';

UPDATE accounts SET account_code = '40', account_name = 'Fournisseurs et comptes rattachés' 
WHERE account_code = '2100';

UPDATE accounts SET account_code = '408', account_name = 'Fournisseurs - Factures non parvenues' 
WHERE account_code = '2130';

UPDATE accounts SET account_code = '16', account_name = 'Emprunts et dettes assimilées' 
WHERE account_code = '2200';

UPDATE accounts SET account_code = '162', account_name = 'Emprunts auprès des établissements de crédit' 
WHERE account_code = '2210';

-- Equity
UPDATE accounts SET account_code = '10', account_name = 'Capital et réserves' 
WHERE account_code = '3000';

UPDATE accounts SET account_name = 'Capital social' 
WHERE account_code = '101';

UPDATE accounts SET account_code = '12', account_name = 'Résultat de l''exercice' 
WHERE account_code = '3200';

UPDATE accounts SET account_code = '109', account_name = 'Compte de l''exploitant (Prélèvements)' 
WHERE account_code = '3300';

-- Revenue
UPDATE accounts SET account_code = '70', account_name = 'Ventes' 
WHERE account_code = '4000';

UPDATE accounts SET account_code = '706', account_name = 'Prestations de services' 
WHERE account_code = '4120';

UPDATE accounts SET account_code = '771', account_name = 'Produits exceptionnels' 
WHERE account_code = '4130';

-- Expenses
UPDATE accounts SET account_code = '60', account_name = 'Achats et variations de stocks' 
WHERE account_code = '5000';

UPDATE accounts SET account_code = '61', account_name = 'Services extérieurs' 
WHERE account_code = '5100';

UPDATE accounts SET account_code = '622', account_name = 'Locations et charges locatives' 
WHERE account_code = '5110';

UPDATE accounts SET account_code = '627', account_name = 'Publicité, publications' 
WHERE account_code = '5120';

UPDATE accounts SET account_code = '6064', account_name = 'Fournitures de bureau' 
WHERE account_code = '5130';

UPDATE accounts SET account_code = '625', account_name = 'Primes d''assurance' 
WHERE account_code = '5140';

UPDATE accounts SET account_code = '681', account_name = 'Dotations aux amortissements' 
WHERE account_code = '5150';

UPDATE accounts SET account_code = '631', account_name = 'Frais bancaires' 
WHERE account_code = '5160';

UPDATE accounts SET account_code = '658', account_name = 'Charges diverses' 
WHERE account_code = '5170';

-- Fix problematic supplier account code  
UPDATE accounts SET account_code = '4010' 
WHERE account_code = '401-3A111B5169';

-- Update account types
UPDATE accounts SET account_type = 'liability' WHERE account_code LIKE '16%';
UPDATE accounts SET account_type = 'equity' WHERE account_code IN ('10', '109', '12');
UPDATE accounts SET account_type = 'expense' WHERE account_code LIKE '6%';
UPDATE accounts SET account_type = 'revenue' WHERE account_code LIKE '7%' AND account_code NOT IN ('701', '706', '709');