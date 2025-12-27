-- Close all open cash sessions
UPDATE cash_sessions 
SET status = 'closed', 
    closed_at = NOW(),
    closing_cash = COALESCE(closing_cash, 0),
    expected_cash = COALESCE(expected_cash, 0),
    cash_difference = 0
WHERE status = 'open';