## Mark cart items as Damage from POS

Add a one-click **Mark as Damage** action to the POS cart so you can pick products (scan or search as usual), then write them off directly to the Damage account (6585) without going through Stock Adjustment or creating a sale.

### Behavior

- New red **"Damage"** button in the cart footer, next to Clear / Pay.
- Enabled only when the cart has at least one real product (ignores `cart-discount` line).
- Clicking it opens a small confirmation dialog listing each line (name, qty, unit cost) and a shared **Reason** field prefilled with `damage` (editable — e.g. `expired`, `broken in transit`).
- On confirm, for each cart line, insert one row into `stock_adjustments` with:
  - `product_id`, `variant_id`, `store_id = selectedStoreId`
  - `adjustment_type = 'damage'`
  - `quantity_change = -qty` (negative, so the existing trigger deducts stock)
  - `unit_cost` from the cart item's cost (fallback to product cost)
  - `reason` from the dialog
  - `adjusted_by = current pos_user id`
- The existing `stock_adjustments` DB trigger handles both:
  - Inventory deduction (product / variant `stock_quantity`)
  - Journal entry: **Dr 6585 Damage / Cr 311 Merchandise Inventory** at cost
- After success: clear cart, toast `Marked N item(s) as damage`, invalidate stock/inventory queries.
- No POS transaction, no receipt, no customer, no cash movement — nothing hits A/R.

### Where it lives

```text
src/pages/admin/POS.tsx
  └── cart footer  →  [Clear]  [Damage]  [Pay]
                                  │
                                  └── <MarkAsDamageDialog />
                                        └── inserts rows into stock_adjustments
```

### Files to change

- `src/components/pos/MarkAsDamageDialog.tsx` — new component (list of cart lines, reason input, confirm/cancel).
- `src/pages/admin/POS.tsx` — add button in cart footer area near `TransactionCart`, wire up dialog, handler that calls `supabase.from('stock_adjustments').insert([...])` in batch, then `clearCart()` and query invalidation.
- No schema change. No RLS change. Uses the same `stock_adjustments` write path Stock Adjustment already uses (permission model unchanged).

### Notes / guardrails

- Cost source: prefer `item.cost_price` from the cart; if missing, fetch from `products` / `product_variants` in the same call so the journal value is accurate.
- Trigger already flips `products.is_available_online` off when stock hits zero — no extra work.
- Editing an existing order and clicking Damage is blocked (button disabled while `editingOrderId` is set) to avoid mixing a sale edit with a write-off.
- Works offline the same way Stock Adjustment does — writes queue through the existing local-first path.
