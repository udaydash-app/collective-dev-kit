# Minimize all dialogs to desktop taskbar

## Goals
1. Add a minimize button (aligned with the X) to all major create/edit dialogs.
2. When minimized, the dialog appears as a taskbar entry next to Purchase/POS app windows — not a floating chip.
3. Right-click any taskbar entry (dialog or app) to get **Restore / Maximize** and **Close**.
4. Restoring re-opens the dialog with all form state preserved (it stays mounted while minimized).

## Approach

### 1. New "minimized dialogs" registry in `windowStore`
Extend `src/store/windowStore.ts` with a second list dedicated to minimized dialogs:
- `minimizedDialogs: { id, title, icon, onRestore, onClose }[]`
- Actions: `registerMinimizedDialog`, `unregisterMinimizedDialog`.
- Stored in memory only (not localStorage — callbacks aren't serializable).

### 2. Reusable `<MinimizableDialog>` wrapper
New file `src/components/ui/minimizable-dialog.tsx` wrapping shadcn `Dialog`:
- Props: `open`, `onOpenChange`, `title`, `icon?`, `onDiscard?`, plus children/className passthrough.
- Internal `minimized` state. When `true`:
  - Renders nothing visible; registers entry in `windowStore.minimizedDialogs` with `onRestore = () => setMinimized(false)` and `onClose = () => { setMinimized(false); onOpenChange(false); onDiscard?.(); }`.
- When `false`: renders `<Dialog open={open && !minimized} ...>` with a `<DialogContent>` that auto-injects the minimize button at `absolute right-14 top-4` matching the X button exactly.
- Guards `onOpenChange(false)` while minimized so clicking the chip area or pressing ESC elsewhere doesn't close it.

### 3. Taskbar shows dialogs + supports right-click
Update `src/components/desktop/Taskbar.tsx`:
- Render `minimizedDialogs` entries after the app windows, with the same styling (muted background to indicate minimized).
- Wrap each taskbar button (both app windows and dialogs) in a shadcn `ContextMenu` with:
  - **Restore / Maximize** → `windowActions.restore` (app) or `entry.onRestore()` (dialog).
  - **Close** → `windowActions.close` (app) or `entry.onClose()` (dialog).

### 4. Migrate dialogs to `<MinimizableDialog>`
Replace `<Dialog>` + `<DialogContent>` usage with the new wrapper for:
- **Ledgerly forms** (`src/ledgerly/pages/`): `JournalForm`, `BillForm`, `InvoiceForm`, `Payments`, `Expenses` (their create/edit dialogs).
- **Admin dialogs** (`src/components/admin/`): `PurchaseOrderDialog`, `PurchasePaymentDialog`, `PurchaseUploadDialog`, `ComboOfferDialog`, `MultiProductBOGODialog`, `MergeAccountsDialog`, `MergeProductsDialog`, `ConvertToPurchaseDialog`, `CreateQuotationFromBillDialog`, `QuoteReviewDialog`, `PendingBillsDialog`, `BulkSellPriceUpdateDialog`, `ExportProductsDialog`.
- **POS dialogs** (`src/components/pos/`): `PaymentModal`, `RefundDialog`, `HoldTicketDialog`, `OrderViewDialog`, `CustomPriceDialog`, `SearchAllSalesDialog`, `AssignBarcodeDialog`, `JournalEntryViewDialog`.
- Each migration is just swapping the `<Dialog>` shell and passing `title` — internal content untouched.
- The existing inline minimize button in `src/pages/admin/Purchases.tsx` (lines 1101–1134) is removed; the wrapper handles it.

## Technical notes
- Wrapper keeps children mounted (`open && !minimized` controls Dialog visibility, but the parent's `open` prop stays true, so form state lives in the parent).
- Right-click uses shadcn `ContextMenu` already in `src/components/ui/`.
- Icon registry: pass `icon` per dialog (e.g. `ShoppingCart` for purchase, `Receipt` for payment) — falls back to a generic `FileText`.
- No changes to business logic, queries, or DB — purely UI plumbing.

## Out of scope
- "Move to taskbar / desktop" toggle and "Keep on top" (not selected).
- Smaller utility dialogs (alerts, confirm prompts) — only large create/edit dialogs are migrated.
