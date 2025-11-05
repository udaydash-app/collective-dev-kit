-- Remove the cash session with 31500 opening cash
DELETE FROM cash_sessions 
WHERE id = '1c2be5fd-27b0-4f33-92dc-2314ec8216b7' 
  AND opening_cash = 31500;