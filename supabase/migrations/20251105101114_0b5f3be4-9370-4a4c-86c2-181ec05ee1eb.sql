-- Correct the opening cash amount for Nov 4th session from 28000 to 31500
UPDATE cash_sessions
SET opening_cash = 31500
WHERE opened_at = '2025-11-04 20:38:02.488+00'
  AND opening_cash = 28000
  AND status = 'open';