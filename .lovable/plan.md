## Goal
After POS login, land on a "Desktop" page that shows every admin module as a tile. Clicking a tile opens that page inside a movable window. Windows can be minimized to a taskbar, restored, maximized, closed, and many can be open at once. Minimized windows keep their internal state (scroll, filters, forms) because they stay mounted.

## User flow
1. Staff signs in via /pos-login → redirected to `/admin/desktop` (instead of `/admin/pos`).
2. Desktop shows wallpaper + grid of tiles (POS, Orders, Products, Inventory Reports, Accounting, Purchases, Contacts, Reports, Settings, etc.) plus a top bar (clock, user, logout) and bottom taskbar.
3. Click a tile → a window opens centered, focused. Title bar shows app name + minimize / maximize / close. Body drag-resizes via a corner handle.
4. Click another tile → second window opens on top with a higher z-index. Click any window to bring it to front.
5. Minimize → window hides but stays mounted; a chip appears in the taskbar. Click the chip to restore at the same position/size with state intact.
6. Maximize → fills the desktop area between top bar and taskbar; toggle to restore.
7. Close → window is removed and unmounted (state lost only on close).
8. Direct URLs like `/admin/orders` still work standalone for deep links and bookmarks; the desktop is an additional shell, not the only way in.

## Tiles
Auto-generated from a central registry of admin routes (so adding a new admin page = one entry). Initial set covers every existing `/admin/*` route grouped into sections:
- POS & Sales: POS, Orders, Quotations, Open Cash Register, Close-Day Report
- Inventory: Products, Categories, Stock & Price, Stock Adjustment, Inventory Reports, Barcode, Production
- Purchasing: Purchases, Purchase Orders, Supplier Payments, Accounts Payable
- Accounting: Chart of Accounts, Journal Entries, General Ledger, Trial Balance, Profit & Loss, Balance Sheet, Cash Flow, Trading Account, Tax Collection, Expenses, Payment Receipts, Accounts Receivable
- Analytics: Dashboard, Analytics, COGS Analysis, Profit Margin Analysis, Profit & Loss Analysis
- Marketing: Offers, Combo Offers, BOGO, Multi-Product BOGO, Announcements
- Admin: Contacts, Import Contacts, Import Products, POS Users, Live Chat, Settings, Pricing

A search field at the top of the desktop filters tiles by name.

## Technical design

### New files
- `src/lib/appRegistry.ts` — array of `{ id, path, title, icon, group, component }` describing every admin app.
- `src/store/windowStore.ts` — zustand store: `windows: WindowState[]`, `openApp(id)`, `closeWindow(id)`, `minimize(id)`, `restore(id)`, `toggleMaximize(id)`, `focus(id)`, `move(id, pos)`, `resize(id, size)`. Persists layout to localStorage so windows survive a refresh.
- `src/pages/admin/Desktop.tsx` — desktop shell: wallpaper, tile grid, search, top bar, taskbar, `<WindowManager />`.
- `src/components/desktop/AppTile.tsx` — single tile (icon, label, click handler).
- `src/components/desktop/Taskbar.tsx` — bottom bar with chips for open windows + clock.
- `src/components/desktop/WindowManager.tsx` — renders all open windows.
- `src/components/desktop/AppWindow.tsx` — single window: title bar (drag handle), control buttons, resizable body, hosts the app component inside its own `MemoryRouter` so internal links don't change the browser URL.
- `src/components/desktop/DesktopRoute.tsx` — `AdminRoute` wrapper for `/admin/desktop`.

### Dependency
- Add `react-rnd` for drag + resize (small, well-maintained). Alternative: hand-rolled handlers; `react-rnd` saves time and edge-case bugs.

### State preservation
Each open window mounts its app component **once** when opened. On minimize the window's outer container gets `hidden` (CSS `display:none`) instead of unmounting — React keeps the component tree, queries, and local state alive. On close the entry is removed from the store and React unmounts it.

### Routing isolation
Each `AppWindow` wraps its app component in `<MemoryRouter initialEntries={[path]}>` so:
- Internal `useNavigate` calls inside a page stay scoped to that window.
- The browser URL stays at `/admin/desktop`, so refreshing returns to the desktop.
- Deep links (`/admin/orders`) opened directly still hit the existing routes in `App.tsx` unchanged.

A small `useNavigate` interceptor inside the window catches `navigate('/admin/...')` calls and, if the target is another registered app, opens it as a new window instead of navigating in place. Non-admin paths fall through to the in-window MemoryRouter.

### Z-index / focus
Store tracks a monotonically increasing `topZ`. `focus(id)` assigns `++topZ` to that window. Clicking anywhere in the window (mousedown capture) focuses it.

### Layout & sizing
- Default window size: 1100x720, clamped to desktop area.
- Spawn position: cascade (each new window offset by 28px from previous).
- Min size 480x320. Maximized = full desktop area.
- Layout persists in `localStorage` keyed per `app id`.

### Login redirect
`src/pages/auth/POSLogin.tsx` currently sends staff to `/admin/pos`. Change the post-login redirect to `/admin/desktop`. Keep `/admin/pos` reachable directly.

### Route registration
Add `<Route path="/admin/desktop" element={<AdminRoute><Desktop /></AdminRoute>} />` in `App.tsx`.

### Known trade-offs
- Heavy pages stay in memory while minimized — that is the requested behavior. Closing reclaims memory.
- Keyboard shortcuts (F2-F4) currently global will be routed only to the focused window (it gets a `data-window-focused` flag we read in the existing shortcut hooks).
- Some pages assume they sit at the full viewport. They are already responsive; we test POS, Products, Orders, Journal Entries inside an ~1100px window; if anything overflows badly we patch the affected page's outer container.
- Page-level `useLocation().pathname` checks (e.g., `POSSessionKeeper`, `BottomNav`) currently gate on `/admin`. Since the browser URL stays at `/admin/desktop` they continue to work. Per-window components that read pathname for self-identification will read the MemoryRouter path inside the window.

## Out of scope (can be follow-ups)
- Per-user pinned tiles / custom desktop layout.
- Right-click context menu on tiles.
- Drag windows between multiple monitors / virtual desktops.
- Snap-to-edge tiling (Windows-style).

## Acceptance criteria
- Login as staff → land on `/admin/desktop` with tiles visible.
- Click POS tile → POS opens in a window; cart works.
- Open Orders and Journal Entries → three windows visible, each focusable.
- Minimize POS → it disappears, chip appears in taskbar; restore → cart still intact.
- Maximize / restore / close work.
- Refresh page → desktop returns; windows reopen at last position (closed windows stay closed).
- Visiting `/admin/orders` directly still renders the standalone page as today.
