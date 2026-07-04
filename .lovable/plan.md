
# Fiscal Period Toggle — Start of Business 01/Jul/2026

## Goal
Set 01/Jul/2026 as the official start of the current fiscal period. Add a period switcher (F12 inside Company Settings) that flips the entire accounting UI between:
- **Before Incorporation** — everything up to and including 30/Jun/2026
- **Current** — from 01/Jul/2026 onward, with previous balances shown as a single "Opening Balance" line per account

## 1. Settings & storage
- Add two fields to `settings` (single-row config): `incorporation_date` (default `2026-07-01`) and `active_period` (`'current' | 'before'`, default `'current'`).
- Store user-selected period in `localStorage` (`fiscalPeriod`) so it persists per device; falls back to settings default.
- New tiny context `FiscalPeriodContext` exposes `{ period, setPeriod, incorporationDate, effectiveFrom, effectiveTo }`.
  - `current`: `from = 2026-07-01`, `to = null` (open)
  - `before`: `from = null`, `to = 2026-06-30`

## 2. Company Settings — F12 dropdown
- On `/admin/company-settings` (or equivalent), bind a global `keydown` for `F12` that opens a Select dropdown with two options.
- Cashiers **and** admins can toggle. Selection saved immediately, triggers `queryClient.invalidateQueries()` so all reports refetch.
- Small badge shown at top of settings page: "Active period: Current (from 01/07/2026)".

## 3. Opening balances — real journal entry
- One-time migration + admin action "Generate Opening Balances":
  - Sums each account's net (debit − credit) for all lines with `entry_date <= 2026-06-30`.
  - Inserts one journal entry dated `2026-06-30` with reference `OPENING-2026-07-01`, one line per non-zero account, balanced against retained-earnings account (SYSCOHADA 1301/1101).
- The opening entry is **tagged** with `is_opening = true` (new boolean column on `journal_entries`) so filters can include/exclude it.
- Rules used by report queries:
  - **Current view**: include lines where `entry_date >= 2026-07-01` **OR** `is_opening = true`. Opening line displays as "Opening Balance" per account at 01/07/2026.
  - **Before view**: include lines where `entry_date <= 2026-06-30` **AND** `is_opening = false`.

## 4. Reports affected
All read the same period context and pass `from`/`to` filters:
- General Ledger (`src/pages/admin/GeneralLedger.tsx` + `src/ledgerly/pages/GeneralLedger.tsx`)
- Trial Balance (`src/ledgerly/pages/TrialBalance.tsx`)
- P&L (`src/ledgerly/pages/ProfitLoss.tsx`)
- Balance Sheet (`src/ledgerly/pages/BalanceSheet.tsx`)
- Journal Entries listing
- Stock reports / dashboards showing opening qty (virtual — computed by summing stock movements up to `effectiveFrom - 1`)

Date pickers on each report default to the period bounds but remain overridable within that period.

## 5. Stock (virtual opening only)
- No new stock snapshot table. Existing `inventory_layers` / stock movement history is queried with the period bounds.
- "Opening Stock" column = sum of movements before `effectiveFrom`; "Current Stock" = opening + movements in period.
- Stock deduction triggers are untouched.

## 6. Safety & audit
- Opening entry can only be generated once (unique constraint on `reference = 'OPENING-2026-07-01'`).
- Admin-only "Regenerate opening" action requires PIN + explicit confirm; deletes prior opening entry and rebuilds.
- All changes respect existing RLS (POS admin/cashier roles).

## 7. Rollout
1. Migration: add `incorporation_date`, `active_period` to `settings`; add `is_opening bool default false` to `journal_entries`; unique index on opening reference.
2. Backend RPC `generate_opening_balances(p_cutoff date)` — computes and inserts atomically.
3. `FiscalPeriodContext` + F12 handler in Company Settings.
4. Update the 4 report pages + GL to consume the context.
5. Update stock dashboard queries.
6. Admin one-click "Generate opening balances" button in Company Settings (runs the RPC).

## Technical notes
- Files touched: `settings` schema, `src/contexts/FiscalPeriodContext.tsx` (new), `src/pages/admin/CompanySettings.tsx` (or `RestaurantSettings.tsx` equivalent), all report pages listed above, `src/ledgerly/lib/fetchAllJournalLines.ts` (accept opening-inclusion flag).
- No changes to POS transaction posting logic — triggers keep writing entries with real dates; the period filter is a read-side concern only.
