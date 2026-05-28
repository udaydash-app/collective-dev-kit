# Plan: Offline login, unified sync page, GitHub publish

## 1. Fix "unable to login when offline"

**Likely root cause** (from reading `src/pages/auth/POSLogin.tsx` and `useAdmin.ts`):
- Offline login uses `offlineDB.getAllPOSUsers()` and matches `pin_hash === pinValue`. This only works if the PIN was cached on a previous *online* login.
- The cache step lives at the bottom of `handleLogin()` *after* the RPC call. If your first online login took the "local Supabase" branch, the cache code runs — but if the IndexedDB write silently fails, or if `dbInitialized` is false when you log in offline, it throws "No cached login data found".
- Console shows `isElectron: false` and `[CloudSync] No local database mode detected` → you're using the browser PWA, not the desktop app. So PIN cache must succeed once online.

**Fix**:
- Always cache the PIN/user record on every successful online verify, regardless of branch (local supabase, cloud, electron).
- Block offline login attempt until `dbInitialized === true` with a clear toast ("Storage still initializing, try again in a moment") instead of erroring out.
- Add a small "Offline cache status" line on the PIN screen showing the number of cached users so you can verify before going offline.

## 2. Unified "Pending Sync" page

Today `Admin → Offline Sync` only lists POS transactions queued in IndexedDB. You want **everything** created offline to surface there: orders, new products, journal entries, expenses, payment receipts, supplier payments, etc.

**Reality check**: The current codebase only queues *POS transactions* into IndexedDB while offline. Every other write (products, expenses, journals, …) goes directly to Supabase via `supabase.from(…).insert(…)`. While offline those calls simply fail — they are not stored anywhere for retry. So a "Pending Sync" hub that shows them requires real plumbing, not just a UI rework.

**Approach** (in two steps):

### Step 2a — UI shell (this iteration)
Restructure `/admin/offline-sync` into a tabbed dashboard with one card per entity type:
- POS Transactions (already works)
- Orders
- Products
- Journal Entries
- Expenses
- Payment Receipts
- Supplier Payments
- Purchases / Stock Adjustments

Each card shows pending count + "View details" drill‑in listing the queued rows, error (if any), and a "Retry" button. Wire POS Transactions to existing data; other cards show "0 pending" placeholders until step 2b is done.

### Step 2b — Pending queue infrastructure (follow‑up)
Add a generic `pending_writes` IndexedDB store: `{ id, table, op, payload, createdAt, error, attempts }`. Build a thin wrapper around `supabase.from(table).insert/update/delete` that, on network failure, enqueues into `pending_writes` and resolves optimistically. A background worker drains the queue when online and surfaces failures to the new page.

This is a substantial refactor (touches every write path). I'll do step 2a now and we can scope 2b separately so we don't change every page in one shot.

## 3. GitHub publish issue

Your `electron-builder.json` already has the right `publish` block. The publish failure is **not** in the repo — it's the token. The 403 you saw earlier (`Resource not accessible by personal access token`) means the token you exported as `GH_TOKEN` is missing `contents: write` on `udaydash-app/collective-dev-kit`.

**Recommended fix — use GitHub Actions instead of publishing from your laptop:**
- The repo already has `.github/workflows/build-release.yml` which builds Windows + macOS and creates a GitHub Release when you push a tag.
- Workflow uses the built‑in `secrets.GITHUB_TOKEN` which always has `contents: write` for the repo — no personal token needed.
- To release v1.1.15 via Actions:
  ```powershell
  npm version 1.1.15 -m "Release v%s"
  git push origin main --follow-tags
  ```
- Then watch the Actions tab; the release will appear under Releases automatically with `latest.yml` + installers, and auto‑update will pick it up.

I'll also tweak the workflow so it actually publishes via electron‑builder (so `latest.yml` is consistent), and remove the `--publish never` flag that's currently neutering it.

---

## Technical changes I'll make in this iteration

1. `src/pages/auth/POSLogin.tsx` — hoist the "cache POS user for offline use" step so it runs on **every** successful online verify (cloud, local supabase, electron); guard offline attempt on `dbInitialized`; show cached user count.
2. `src/pages/admin/OfflineSync.tsx` — restructure into a tabbed/multi‑card "Pending Sync" hub. POS Transactions tab keeps current behavior; other tabs render counts from IndexedDB stores already cached (orders, journal entries, expenses, payment receipts, supplier payments, products) — even if those stores are currently used for cache only, the UI is wired so step 2b can drop the real pending queue in.
3. `.github/workflows/build-release.yml` — switch Windows job to `--publish always` and let `GITHUB_TOKEN` create the release directly; drop the manual `softprops/action-gh-release` step (or keep only for mac assets).

## What I will NOT do in this iteration
- Build the generic offline write‑queue (step 2b). That needs its own planning round because it touches dozens of files.
- Push tags or run the workflow for you — you'll trigger v1.1.15 from PowerShell.

Reply "go" to proceed, or tell me to split this differently (e.g. just fix login first).
