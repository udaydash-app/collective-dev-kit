
# Local-first Windows app with bundled Postgres

## Goal

Stop relying on IndexedDB shims and Supabase-as-source-of-truth. Ship a Windows installer that contains a fully provisioned local Postgres database (PGlite) and the edge-function logic in a `data/` folder. The app reads/writes locally first; a background worker pushes/pulls to Supabase with last-write-wins.

## Target architecture

```text
GlobalMarket.exe (Electron)
├── app/
│   ├── renderer/         React UI (current src/, unchanged surface)
│   ├── main/             Electron main process
│   └── data/             ← shipped with installer
│       ├── pglite/       Embedded Postgres data dir (seeded snapshot)
│       ├── schema.sql    All migrations squashed
│       ├── seed.sql      Snapshot dump from cloud at build time
│       ├── functions/    Ported edge functions (TS modules)
│       └── sync/         Outbox + cursor state
```

All app DB calls go through one client (`src/integrations/db/client.ts`) that:
- In Electron → talks to local PGlite via IPC
- In browser/PWA fallback → talks to Supabase directly (unchanged)

## Step 1 — Embed PGlite

- Add `@electric-sql/pglite` and run it in the Electron **main process** with data dir = `app.getPath('userData')/data/pglite` (copied from bundled `data/pglite` on first launch).
- Expose a typed IPC bridge: `db.query(sql, params)`, `db.exec(sql)`, `db.transaction(fn)`.
- All existing Postgres features used by the app (triggers, `pgcrypto`, `pg_trgm`, JSONB, `gen_random_uuid`) are supported by PGlite via extensions — enable `pgcrypto` and `pg_trgm` on init.

## Step 2 — Squash the schema for local use

- Generate `data/schema.sql` from current cloud DB:
  - All tables + GRANTs collapsed to a single role (local app uses one connection, no RLS needed locally — RLS stays on cloud).
  - All functions and triggers (the long list in current_db_functions: stock triggers, journal triggers, payment triggers, `resolve_auth_user_id`, `has_role`, etc.).
  - All sequences and enums (`app_role`, etc.).
- Add a build-time script `scripts/build-local-db.ts` that:
  1. Connects to cloud Supabase with service role
  2. `pg_dump --schema-only` → `data/schema.sql`
  3. `pg_dump --data-only` → `data/seed.sql`
  4. Boots a temporary PGlite, applies both, snapshots its data dir into `data/pglite/`
- Re-runs on every release build so the installer ships current data.

## Step 3 — Build the local DB client

Replace the dual-path code currently scattered across `cacheData.ts`, `offlineDB.ts`, `cloudSyncService.ts`, and per-page `shouldUseLocalData()` checks with a single Supabase-compatible facade:

```ts
// src/integrations/db/client.ts
export const db = isElectron() ? localDb : supabase;
```

`localDb` implements the subset of `supabase-js` the app actually uses (`from().select/insert/update/delete/eq/in/order/range/maybeSingle/single`, `rpc`, `auth.getUser` → returns the PIN session). Existing pages keep their `.from('products').select(...)` calls unchanged.

This deletes ~90% of the IndexedDB fallback code.

## Step 4 — Port edge functions to local handlers

Each function in `supabase/functions/*` becomes a TS module in `data/functions/<name>.ts` exporting `handler(payload, ctx)`. The local client's `functions.invoke('name', { body })` dispatches to that module when running in Electron.

Functions to port:
- `ai-search`, `enrich-product`, `manage-pos-user`, `ensure-pos-auth`, `create-guest-order`, `import-products`, `import-contacts`, `send-order-confirmation`, `submit-po-quote`, `update-products-pdf`, `update-products-excel`, `import-products-excel`, `cleanup-duplicate-variants`, `powersync-credentials`.

Functions that need network (`ai-search`, `enrich-product`, `send-order-confirmation`) check connectivity; if offline they queue to outbox and return a queued response.

## Step 5 — Background sync worker

A worker thread in the Electron main process, started on app launch:

**Outbox push (local → cloud)**
- Every mutating local query also writes a row to `_sync_outbox(id, table, op, pk, payload, updated_at, attempts)`.
- Worker batches outbox rows, sends to Supabase, marks synced on success. Failures retry with backoff. Manual "force sync" button in UI.

**Pull (cloud → local)**
- Worker polls cloud per table using `updated_at > last_cursor` (cursor stored in `_sync_cursor`).
- For each row, **last-write-wins by `updated_at`**: if cloud `updated_at` ≥ local → upsert local; else keep local (it will push up later).
- Realtime channel subscribes to inserts/updates while online for near-instant pull.

**Auth ID mapping**
- The `resolve_auth_user_id()` helper already maps `pos_users.id` → `auth.users.id`. Sync worker uses it on push so journal entries don't violate FKs in cloud.

**Conflict handling**
- LWW is per-row. For journal_entries and stock rows the existing triggers run locally on insert and again on cloud (idempotent because triggers DELETE prior journal entry by `reference` before inserting).

## Step 6 — Electron packaging

- Use `@electron/packager` (already documented constraint — electron-builder doesn't work in sandbox; but for actual Windows installer we'll use `electron-builder` from the user's Windows CI or local machine with NSIS target).
- `package.json` `build.extraResources` includes `data/` so the seeded `pglite/` snapshot ships inside `resources/data/`.
- On first launch, main process copies `resources/data/pglite` → `userData/data/pglite` if not present.
- Vite config: `base: './'`, Electron main file `.cjs`, contextIsolation on.

## Step 7 — Cleanup

After the local DB is the source of truth, delete:
- `src/lib/offlineDB.ts` (IndexedDB shim)
- `src/lib/cacheData.ts` (cloud→IndexedDB cache)
- All `shouldUseLocalData()` branches in pages
- `scripts/local-db-setup.sql` Docker path (memory will be updated)

Keep `cloudSyncService.ts` repurposed as the outbox/cursor manager.

## Technical notes

- **PGlite limits**: single-connection (fine for desktop app), no `pg_cron`/`pg_net` (cron jobs stay cloud-only — they trigger via Supabase scheduler, results pulled by sync worker). Auth (`auth.users`) is not provided by PGlite — we replace `auth.uid()` with a local session function that returns the active `pos_users.user_id`.
- **FK to `auth.users`**: in local schema, drop these FKs (or repoint to a local `auth_users_mirror` table populated by sync). The cloud keeps its real FKs.
- **Triggers calling `SELECT id FROM accounts WHERE account_code='571'`** work unchanged — accounts table is in the seed dump.
- **Installer size**: PGlite WASM ~3MB, seed dump depends on data (estimate 20–80MB for current cloud). Acceptable for a desktop install.
- **Per-machine first-run**: After install, if user logs in with cloud credentials, the worker does an initial full pull to overwrite the bundled snapshot with the latest cloud state (config flag `seedMode = 'snapshot' | 'fresh-pull'`).

## Phasing

1. **Phase A** — PGlite + IPC bridge + `localDb` facade + schema.sql + seed dump script. App runs locally end-to-end with no sync.
2. **Phase B** — Port edge functions to local handlers.
3. **Phase C** — Outbox push worker + cursor pull worker + LWW logic.
4. **Phase D** — Electron packaging, installer with bundled `data/`, first-run copy logic.
5. **Phase E** — Remove old IndexedDB code, update memory docs.

Each phase is independently testable in dev (Electron `npm run electron:dev`).
