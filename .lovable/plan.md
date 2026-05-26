# Full offline-first migration: RxDB + PowerSync Cloud

## Goal
The app reads and writes against a **local database on the user's computer** (RxDB, persisted in IndexedDB / OPFS / SQLite-in-Electron). When internet is available, **PowerSync Cloud** streams changes both ways between the local DB and Supabase Postgres. The UI never blocks on the network.

## End-state architecture

```text
   React UI (hooks, react-query)
            │  (reactive queries, instant)
            ▼
       RxDB collections  ◄── single source of truth for the UI
            │
            ▼
   @powersync/web adapter (IndexedDB / OPFS storage)
            │  WebSocket sync protocol (when online)
            ▼
   PowerSync Cloud Service
            │  logical replication
            ▼
   Supabase Postgres (wvdrsofehwiopbkzrqit)
            │
            └─► triggers still own stock + journal entries (unchanged)
```

Key principle: **all reads and writes go through RxDB**. PowerSync handles upload/download in the background. We delete the custom `syncService`, `cloudSyncService`, `offlineDB`, and LAN-Supabase fallback once the migration is verified.

## Scope of changes (full migration)

### 1. PowerSync Cloud setup (user-side, documented in plan)
- Create PowerSync Cloud instance, point it at the Supabase project (provide connection string + replication slot).
- Configure a **PowerSync Sync Rules** YAML that mirrors RLS intent (per-store, per-role buckets).
- Issue a **dev/service sync token** signed with a shared HS256 secret stored in PowerSync. Devices on LAN use this token — no Supabase JWT required, matching the existing PIN-only auth model.

Secrets to add in Lovable: `POWERSYNC_URL`, `POWERSYNC_DEV_TOKEN` (publishable — embedded in client because LAN devices are trusted), plus a backend-only `POWERSYNC_JWT_SECRET` for an edge function that can mint scoped tokens later.

### 2. Dependencies
Add: `@powersync/web`, `@powersync/react`, `rxdb`, `rxdb-premium`-free equivalents only (`rxdb/plugins/storage-dexie` for now), `zod` (already present) for schema validation.
Remove (after migration): `idb`-based `offlineDB`, custom `syncService`, `cloudSyncService`.

### 3. Local schema layer (`src/db/`)
Create:
- `src/db/schema.ts` — RxDB JSON schemas for every synced table: `products`, `product_variants`, `categories`, `stores`, `orders`, `order_items`, `pos_transactions`, `cash_sessions`, `purchases`, `purchase_items`, `expenses`, `journal_entries`, `journal_entry_lines`, `accounts`, `contacts`, `pos_users`, `addresses`, `announcements`, etc. (full list derived from `integrations/supabase/types.ts`).
- `src/db/powersync.ts` — PowerSync client init with `@powersync/web` + IndexedDB storage, wired to `POWERSYNC_URL` and the dev token.
- `src/db/rxdb.ts` — RxDatabase wrapper exposing typed collections + a PowerSync replication plugin so writes go to the PowerSync upload queue.
- `src/db/index.ts` — single `getDB()` accessor used by hooks.

### 4. Data hook rewrite
Replace every Supabase read hook with an RxDB reactive query. Examples:
- `useLocalData.ts` → thin shim over `useQuery` from `@powersync/react` that returns live collection results.
- `useOfflineData.ts` → deleted; merged into the new hook.
- Every page that currently does `supabase.from('x').select(...)` switches to `db.collections.x.find({...}).$` (RxJS observable) bridged into TanStack Query for compatibility, OR direct subscription.

Write paths (`insert`/`update`/`delete`) become `collection.insert(doc)` / `doc.patch(...)`. Writes are instant locally; PowerSync flushes them to Supabase when online.

### 5. Triggers & business logic stay server-side
Stock deduction, journal entry creation, timbre tax — **unchanged**. They run in Supabase when PowerSync replicates the row in. The client optimistically shows the write; the trigger's resulting rows stream back down.

### 6. Auth bridge
- POS PIN login keeps producing `offline_pos_session`.
- A small helper exchanges the PIN session for the **dev sync token** and feeds it to PowerSync's `fetchCredentials` callback.
- Admin pages still use `useAdmin` (Supabase JWT) for the small number of operations that must hit Supabase directly (edge functions like `manage-pos-user`, `import-products-excel`). Those keep using the current Supabase client.

### 7. Realtime, cache & wake-recovery cleanup
- Remove the Supabase Realtime channel in `AdminRoute` (new-order toast) and replace with an RxDB change-stream subscription on the `orders` collection — works offline too.
- Remove `useCloudSync`, `useOfflineSync`, `cacheEssentialData`, `recoverAfterWake` Supabase invalidation. RxDB is always fresh; PowerSync handles reconnection.
- Keep React Query only for edge-function calls.

### 8. Migration & rollout steps
1. Land PowerSync setup + RxDB scaffolding behind a `VITE_USE_RXDB=true` flag.
2. Migrate read paths page by page: Products → POS → Orders → Accounting → Admin reports. Each page verified in preview before moving on.
3. Migrate write paths the same way.
4. Once all green, flip the flag default, delete `offlineDB`, `syncService`, `cloudSyncService`, LAN Supabase Docker code paths, and `scripts/local-db-setup.sql`.
5. Update memory: remove the LAN Docker / IndexedDB-cache rules; add new RxDB+PowerSync rules.

## What the user has to do once
- Create a PowerSync Cloud project at journeyapps.com, connect it to Supabase, paste in:
  - `POWERSYNC_URL`
  - `POWERSYNC_DEV_TOKEN`
  - `POWERSYNC_JWT_SECRET` (backend only)
- Apply the generated sync rules YAML in the PowerSync dashboard (I will produce it).
- Enable Postgres logical replication on the Supabase project (one-click in dashboard).

## What stays the same
- Supabase Postgres remains the canonical store and the place all triggers run.
- All edge functions, RLS policies, accounting logic, SYSCOHADA codes, Timbre rules, receipts, kiosk printing — untouched.
- UI, routes, navigation — untouched.

## Risks & mitigations
- **Schema drift**: RxDB schemas must match Supabase column types. Mitigation: generate them from `types.ts` via a small script.
- **Large initial download**: First sync pulls every row the user is allowed to see. Mitigation: PowerSync sync rules bucket by `store_id` and recency (e.g., last 12 months of transactions).
- **Conflict resolution**: Last-write-wins by default; for stock-sensitive rows the server trigger is authoritative anyway.
- **Dev token in client**: Acceptable because the project is private/LAN. Documented in security memory.

## Deliverable order (once you approve)
1. Add deps + secrets prompts.
2. Create `src/db/` layer + sync rules file.
3. Migrate Products + POS pages as the first vertical slice and verify in preview.
4. Continue module-by-module until the feature flag can be flipped on by default.
