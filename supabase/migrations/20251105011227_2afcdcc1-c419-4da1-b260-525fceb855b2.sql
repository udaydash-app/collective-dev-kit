-- Restore the cash session opened on Nov 4th with 28,000 opening cash
INSERT INTO cash_sessions (
  store_id,
  cashier_id,
  opening_cash,
  opened_at,
  status,
  created_at,
  updated_at
) VALUES (
  '086e4c9f-c660-41fc-ab94-552393c13be8',
  'b518fa67-e33e-43e5-9d25-8a3b4fbbce00',
  28000,
  '2025-11-04 20:38:02.488+00',
  'open',
  now(),
  now()
);