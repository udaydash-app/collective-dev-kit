
# Masked Selling Price (POS/Admin only) with Dual Accounting

## Scope
Masking applies ONLY inside the authenticated POS/Admin session (valid PIN via `/pos-login` → `offline_pos_session`). Storefront (customer routes, guest checkout, customer emails) is untouched.

Gate: `usePriceMasking()` → `enabled = hasValidPosSession()`. All masking helpers no-op when disabled.

## Formula
`maskedPrice = ceilTo500((cif_unit_cost + local_charges_per_unit) × 1.25)`
- `ceilTo500(x) = Math.ceil(x / 500) * 500` → 1000.345 → 1500; 2000 → 2000; 2001 → 2500
- Cost fallback: `products.unit_cost` + `products.local_charges_per_unit` → most recent `inventory_layers` → 0

## F12 Behavior (momentary, global inside POS/Admin)
Each F12 keydown flips `revealRealPrice = true` for 3 seconds; re-press to keep revealing. Provided via `PriceRevealContext` mounted on POS/Admin route subtree only.

While reveal is active, every masked value swaps to its real counterpart reactively across:
- POS product search, cart lines and totals, payment modal, held tickets, refund/custom-price dialogs
- Admin product lists, order/sales screens
- Accounting reports (queries re-fire with `is_real_ledger = true`)
- End-of-day close dialog, session summary, **Z report**

## F12 During Print / Share (new, edit/update, EOD, Z report)
Print, PDF, and WhatsApp handlers read `revealRealPrice` at click-time:
- Reveal on → render real values from stored `realPrice` / `real_*` columns
- Reveal off → render masked values (default)

Applies to: new sale checkout print, reprint from search dialogs, refund receipt, edit/update of an existing POS transaction, EOD summary/receipt, and printed **Z report**.

## Cart Pickup & Persistence
`usePOSTransaction`:
- Each line stores `price` (masked at add time) and `realPrice` (real at add time); both survive edits.
- Update recomputes both masked and real totals; persists `real_*` columns alongside masked.
- Cart totals display masked when reveal off, real when reveal on — computed live from stored per-line values.

Storefront `useCart` not modified.

## End of Day / Cash Session Close + Z Report
`cash_sessions` and closure flow behave the same way:
- All aggregates (expected cash, expected mobile, total sales, tax, discount, split-payment breakdowns) compute from MASKED `pos_transactions.total` / `subtotal` / `tax` / `discount` by default.
- New columns on `cash_sessions`: `real_expected_cash`, `real_expected_mobile`, `real_total_sales`, `real_tax_collected`, `real_discount_given`, `real_variance` — computed from `real_*` transaction columns and persisted on close.
- Physical cash counting inputs (what cashier types) are unaffected. Only *expected*/*system* side is dual-tracked.
- EOD journal entries (`REG-` prefix) dual-post: masked entry (default) + mirrored real entry with `is_real_ledger = true`, linked via `masked_entry_id`.

**Z Report (new, rendered inside end-of-day dialog):**
- Fiscal-style Z report component listing: opening float, gross sales, tax collected, discounts given, refunds, net sales, expected cash, expected mobile, split-payment totals, transaction count, first/last transaction number.
- All figures computed from MASKED transaction columns by default. When F12 reveal is active, every figure on screen swaps to the corresponding `real_*` value live.
- Print / PDF / WhatsApp share of the Z report reads `revealRealPrice` at click-time and generates the ticket accordingly. Default = masked; F12-held click = real.
- Z report values are persisted onto `cash_sessions` at close (both masked and real snapshots) so reprints later always match the values seen at close time, and the same F12 toggle switches between them.

## Central Helpers
- `src/lib/priceMasking.ts` — `computeMaskedPrice`, `getDisplayPrice`, `formatDisplayPrice`, `ceilTo500`
- `src/contexts/PriceRevealContext.tsx` — F12 listener + 3s timeout + provider + `useRevealRealPrice()`
- `src/hooks/usePriceMasking.ts` — session-gated enabled flag

## POS / Admin UI (masked default; F12 reveals real live)
POS: `ProductSearch`, `TransactionCart`, `PaymentModal`, `Receipt`, `SearchAllSalesDialog`, `OrderViewDialog`, `RefundDialog`, `QuickPaymentDialog`, `CustomPriceDialog`, `HoldTicketDialog`
Cash session / EOD: `CashInDialog`, `CashOutDialog`, end-of-day close dialog, session summary, EOD receipt, **new Z report component + print**
Admin products: `Products`, `ResizableProductsTable`, `BulkSellPriceUpdateDialog`, `ExportProductsDialog`
Admin sales/orders: `admin/Orders`, admin order dialogs
Accounting: `GeneralLedger`, `JournalEntries`, `TrialBalance`, `ProfitLoss`, `BalanceSheet`

Always-real (never masked):
- Add/Edit Product dialog (selling price field)
- Purchase entry, supplier bills, cost inputs
- Physical cash count inputs on EOD

## Dual Accounting (store BOTH)
Migration `<ts>_dual_price_accounting.sql`:
- `pos_transactions`: `real_total`, `real_subtotal`, `real_tax`, `real_discount`; each `items` JSONB line gains `realPrice`
- `orders` (POS-created): `real_total`, `real_subtotal`; storefront orders keep `real_*` NULL
- `order_items` (POS-created): `real_unit_price`, `real_total_price`
- `cash_sessions`: `real_expected_cash`, `real_expected_mobile`, `real_total_sales`, `real_tax_collected`, `real_discount_given`, `real_variance`, plus JSONB `z_report_masked` and `z_report_real` snapshots for reprint parity
- `journal_entries`: `is_real_ledger boolean default false`, `masked_entry_id uuid` self-ref
- POS-originated triggers and EOD close trigger insert TWO journal entries (masked default + mirrored real, linked). Storefront posts stay single-entry real.
- Reports default `is_real_ledger = false`; F12 re-queries with `true`
- Backfill copies current values into both real and masked columns

## Files

**New**
- `src/lib/priceMasking.ts`
- `src/contexts/PriceRevealContext.tsx`
- `src/hooks/usePriceMasking.ts`
- `src/components/pos/ZReport.tsx` (screen + printable)
- `supabase/migrations/<ts>_dual_price_accounting.sql`

**Edited (POS/Admin only)**
- `src/hooks/usePOSTransaction.ts`
- `src/components/pos/ProductSearch.tsx`, `TransactionCart.tsx`, `PaymentModal.tsx`, `Receipt.tsx`, `SearchAllSalesDialog.tsx`, `OrderViewDialog.tsx`, `RefundDialog.tsx`, `QuickPaymentDialog.tsx`, `CustomPriceDialog.tsx`, `HoldTicketDialog.tsx`, `CashInDialog.tsx`, `CashOutDialog.tsx`
- POS end-of-day close dialog + session summary + EOD receipt component (embed new `<ZReport />` inside EOD dialog)
- `src/pages/admin/Products.tsx`, `src/components/admin/ResizableProductsTable.tsx`, `BulkSellPriceUpdateDialog.tsx`, `ExportProductsDialog.tsx`
- `src/pages/admin/Orders.tsx`, admin order/sales dialogs
- `src/pages/admin/GeneralLedger.tsx`, `JournalEntries.tsx`, `TrialBalance.tsx`, `ProfitLoss.tsx`, `BalanceSheet.tsx`
- `src/lib/kioskPrint.ts` and POS WhatsApp/PDF share helpers — accept `showRealPrices`
- `src/App.tsx` — wrap POS/Admin subtree in `<PriceRevealProvider>`

**NOT touched**
- Storefront pages, `useCart`, `create-guest-order`, `send-order-confirmation`, customer receipts/emails
