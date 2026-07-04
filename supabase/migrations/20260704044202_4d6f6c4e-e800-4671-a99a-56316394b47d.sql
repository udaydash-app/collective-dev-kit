-- Dual price accounting: masked + real columns (schema only, no backfill).
-- App fills real_* on future transactions; readers treat NULL real_* as "same as current value".

ALTER TABLE public.pos_transactions
  ADD COLUMN IF NOT EXISTS real_total numeric,
  ADD COLUMN IF NOT EXISTS real_subtotal numeric,
  ADD COLUMN IF NOT EXISTS real_tax numeric,
  ADD COLUMN IF NOT EXISTS real_discount numeric;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS real_total numeric,
  ADD COLUMN IF NOT EXISTS real_subtotal numeric;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS real_unit_price numeric,
  ADD COLUMN IF NOT EXISTS real_total_price numeric;

ALTER TABLE public.cash_sessions
  ADD COLUMN IF NOT EXISTS real_expected_cash numeric,
  ADD COLUMN IF NOT EXISTS real_expected_mobile numeric,
  ADD COLUMN IF NOT EXISTS real_total_sales numeric,
  ADD COLUMN IF NOT EXISTS real_tax_collected numeric,
  ADD COLUMN IF NOT EXISTS real_discount_given numeric,
  ADD COLUMN IF NOT EXISTS real_variance numeric,
  ADD COLUMN IF NOT EXISTS z_report_masked jsonb,
  ADD COLUMN IF NOT EXISTS z_report_real jsonb;

ALTER TABLE public.journal_entries
  ADD COLUMN IF NOT EXISTS is_real_ledger boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS masked_entry_id uuid REFERENCES public.journal_entries(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_journal_entries_is_real_ledger
  ON public.journal_entries(is_real_ledger);
CREATE INDEX IF NOT EXISTS idx_journal_entries_masked_entry_id
  ON public.journal_entries(masked_entry_id);