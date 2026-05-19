## Special Offer (cart-total threshold)

Add a new "Special Offer" type to the **Sales → Offers** menu that triggers automatically in POS when the cart subtotal reaches a configured threshold (e.g. 150,000 FCFA). On match, POS prompts the cashier to convert to the special offer; on accept, a 15% cart discount is applied and a notice is printed/sent on every receipt channel.

### 1. Database (new migration)
Create table `special_offers`:
- `name` (text), `threshold_amount` (numeric), `discount_percentage` (numeric), `match_mode` (text: `equals` | `gte`, default `equals`), `is_active` (bool, default true), `store_id` (uuid, nullable = all stores)
- Standard `id`, `created_at`, `updated_at`
- RLS: read for authenticated/anon (POS needs it offline-ish); insert/update/delete restricted to admin role via `has_role`

### 2. Admin UI — `src/pages/admin/Offers.tsx`
- Add **"Special Offer (Cart Threshold)"** entry in the "Add Offer" dropdown
- New `SpecialOfferDialog` form: name, threshold amount, discount %, equals/≥ toggle, active switch
- New section/table on the same page listing existing special offers with edit/delete

### 3. POS detection & prompt — `src/pages/admin/POS.tsx`
- Fetch active special offers (filtered by current store or global) on mount + via realtime
- After every cart mutation, compute `cartSubtotal` (excluding `cart-discount` line) and look for a matching active offer:
  - `equals`: exact match (rounded to whole FCFA)
  - `gte`: subtotal ≥ threshold
- When a match is detected and not yet applied/declined for this cart state, open a confirmation dialog: *"Convert to special offer 'X' — apply Y% cart discount?"*
- On confirm → call existing cart-discount apply path with `value = discountPercentage` in `cartDiscount` % mode (existing `cart-discount` item creation). Mark `specialOfferApplied = { name, percentage }` on the transaction state.
- Reset flag when cart is cleared / payment completed
- Persist applied flag onto the saved transaction (extend `pos_transactions.metadata` JSON if available, otherwise stash in `delivery_instructions`-style notes field — pick the existing notes column already used by POS)

### 4. Receipt message ("you have availed special offer discount 15%")
Add an optional `specialOfferNote` field carried alongside receipt data and rendered in all four channels:

| File | Change |
|---|---|
| `src/lib/kioskPrint.ts` | Add `specialOfferNote?: string` to `KioskReceiptData`; render a bold centered line above footer when set |
| `src/lib/qzTray.ts` | Same field on `QZReceiptData`; emit bold centered ESC/POS line |
| `src/components/pos/Receipt.tsx` (PDF/screen receipt) | Display the message under totals |
| WhatsApp share text (search for the existing whatsapp message builder in POS / OrderDetails) | Append `\n🎉 You have availed special offer discount {pct}%` when flag present |

Plumb `specialOfferNote` from POS state through every call site that creates receipts.

### 5. Edge cases
- Hide/skip the prompt when a cart discount is already present (manual or special)
- Re-evaluate when items added/removed; if cart drops below threshold, auto-remove the special-offer cart discount and clear the flag
- Multiple matching offers: pick highest discount %
- Offline: query from IndexedDB cache the same way other POS data is cached (`cacheData.ts` pattern)

### Technical notes
- Reuse the existing cart-discount mechanism (`cart-discount` line item with negative price) — no new payment math
- Compute `specialOfferApplied` purely in client state; no server-side trigger needed
- The new table does NOT post journal entries (discount already reflected in `701` sales via existing flow)

---
**Scope confirmation needed before I build:**
1. Threshold match: **exact equals 150,000** as stated, or **≥ 150,000**? (recommend `gte` so a slightly larger cart still qualifies — I'll make it a toggle, default `equals` per your wording)
2. Confirm WhatsApp message wording: `"You have availed special offer discount 15%"` — keep verbatim?