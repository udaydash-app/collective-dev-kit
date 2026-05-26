# Local-First Migration for Remaining Admin Pages

## Goal
Make every admin page read from the local PowerSync SQLite mirror first (so it works offline / on flaky internet), falling back to Supabase only if the local read fails. Writes stay on Supabase — PowerSync replicates them back.

## Pages still reading Supabase directly (12)
1. Dashboard / DashboardModern
2. Orders (mostly migrated — finish remaining queries)
3. Contacts (finish)
4. PurchaseOrders (finish)
5. POSUsers
6. POS (POS terminal)
7. Production
8. Quotations
9. Offers
10. BOGOOffers
11. ChartOfAccounts (finish)
12. ProfitLoss (finish)

## Approach (per page)
1. Add a `fetchXLocal(...)` helper in `src/db/queries/` that runs `db.getAll(...)` against the PowerSync SQLite mirror and returns the same shape the page already expects.
2. In the page's `useQuery` (or equivalent), wrap the existing Supabase call in:
   ```ts
   try { return await fetchXLocal(args); }
   catch (e) { console.warn('[x] local failed, falling back', e); }
   // existing supabase code
   ```
3. Leave mutations (insert/update/delete) on `supabase.from(...)` — PowerSync's upload queue + `useOfflineSync` already drains them when connectivity returns.
4. Verify each page loads in the browser at PIN 1980.

## Batching
- **Batch A — accounting/reporting tails:** ChartOfAccounts, ProfitLoss, Dashboard(Modern), Orders, Contacts, PurchaseOrders remaining queries.
- **Batch B — operational:** POSUsers, Production, Quotations.
- **Batch C — marketing:** Offers, BOGOOffers.
- **Batch D — POS terminal:** POS.tsx (largest; needs care since it already has IndexedDB fallback through `offlineDB`).

After each batch I'll smoke-test the affected pages in the preview, then move on.

## Non-goals
- No schema changes.
- No change to write paths or business logic.
- No visual/UI changes.

## Risk
- PowerSync schema may be missing some tables/columns used by these pages. If so, the local fetch will throw and the page silently falls back to Supabase (same behaviour as today) — I'll log a warning so we can extend `src/db/schema.ts` later.
