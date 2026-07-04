# Extend F12 masked/real toggle to AR/AP and all reports

## Goal
Every screen where a sales price / revenue / customer balance is displayed must respect the F12 reveal rule (masked ledger by default, real ledger while F12 is held), matching the pattern already used in Trial Balance, Balance Sheet, P&L, Trading Account, General Ledger and Journal Entries.

## Pages to update

### Receivables/Payables (balance from journal lines, not cached `current_balance`)
1. `AccountsReceivable.tsx` — derive each customer balance from `journal_entry_lines` joined to `journal_entries` filtered by `is_real_ledger` per F12; keep dual-role netting.
2. `AccountsPayable.tsx` — same pattern for supplier ledger accounts.

### Sales / revenue reports
3. `Analytics.tsx` — revenue, top products, charts should read `real_subtotal`/`real_discount` when F12 held, else `subtotal`/`discount`.
4. `CashFlow.tsx` — sales inflows via `pickSubtotal`/`pickDiscount` helper (same as ProfitLoss).
5. `COGSAnalysis.tsx` — revenue side switches to real; cost side stays as-is.
6. `Dashboard.tsx` and `DashboardModern.tsx` — today/period revenue tiles + charts.
7. `ProfitLossAnalysis.tsx` — mirror ProfitLoss.tsx changes.
8. `ProfitMarginAnalysis.tsx` — revenue and margin use real when F12.
9. `SalesTarget.tsx` — achieved sales figure.
10. `TaxCollectionReport.tsx` — tax base derived from sale price; switch base to real when F12.
11. `InventoryReports.tsx` — only the "sales value / stock value at sale price" columns need the toggle; cost columns unchanged.
12. `CloseDayReport.tsx` — already imports masking; audit sale totals to confirm they use `pickSubtotal` pattern (fix if missing).
13. `PaymentReceipts.tsx` / `SupplierPayments.tsx` — payment amounts are actual cash movements (not masked), leave unchanged. Document this in code comments.

## Shared plumbing
- Reuse `usePriceMasking` + `revealRealPrice` gating (`isRealLedger = revealRealPrice && maskingEnabled`).
- Reuse the `pickSubtotal(s)`/`pickDiscount(s)` helpers from `ProfitLoss.tsx` — extract to `src/lib/priceMasking.ts` as `pickSaleSubtotal` / `pickSaleDiscount` so all reports share one implementation.
- Extend `fetchAccountBalancesLocal` (already accepts `isRealLedger`) with a new helper `fetchContactBalancesFromJournalLocal(contactIds, isRealLedger)` used by AR/AP for per-account balances from `journal_entry_lines`.
- Every affected `useQuery` must include `isRealLedger` in its `queryKey` so F12 triggers a refetch.

## Out of scope
Cost-only reports, purchase/expense screens, cash register entries, supplier/customer payment logs (real cash movements).

## Verification
- Typecheck.
- Manually toggle F12 on each updated page and confirm totals change and revert.
- Confirm AR/AP totals match General Ledger customer/supplier account balances for both masked and real mode.
