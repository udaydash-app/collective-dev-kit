
-- Recover the missing POS transaction from journal entry
INSERT INTO pos_transactions (
  transaction_number,
  store_id,
  cashier_id,
  customer_id,
  items,
  subtotal,
  tax,
  discount,
  total,
  payment_method,
  notes,
  created_at,
  updated_at
)
SELECT 
  'POS-FAD0ECC6EC',
  '086e4c9f-c660-41fc-ab94-552393c13be8',
  'b518fa67-e33e-43e5-9d25-8a3b4fbbce00',
  'aa544e62-5588-42e0-ac22-60fdca6f4ed9',
  '[]'::jsonb,
  25500.00,
  0,
  0,
  25500.00,
  'credit',
  'RECOVERED TRANSACTION: Item details unavailable. Original transaction created at 2025-11-03 11:45 AM. Please refer to journal entry JE-0153F73121 for accounting details.',
  '2025-11-03 11:45:57.541119+00'::timestamp with time zone,
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM pos_transactions WHERE transaction_number = 'POS-FAD0ECC6EC'
);
