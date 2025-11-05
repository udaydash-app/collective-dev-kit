-- Remove the incorrect cash session with 0 opening cash
DELETE FROM cash_sessions 
WHERE id = '72e7dd43-19fb-4448-8871-fa4bbe20ce00' 
  AND opening_cash = 0 
  AND opened_at = '2025-11-04 23:47:56.236984+00';