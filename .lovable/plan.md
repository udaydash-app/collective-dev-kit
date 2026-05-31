
## Restaurant POS — new desktop app

A new tile **Restaurant** on the admin Desktop opens a full-screen restaurant POS supporting Dine-in, Takeaway, and Delivery, with its own isolated data model.

### 1. Database (new isolated tables)

All under `public.*`, with grants + RLS following project conventions. Stock deduction for recipe ingredients reuses existing products table via a trigger.

- `restaurant_tables` — floor plan: `id`, `store_id`, `name`, `seats`, `x`, `y`, `shape` (round/square), `status` (free/occupied/reserved/bill).
- `restaurant_menu_categories` — `id`, `name`, `sort_order`, `color`.
- `restaurant_menu_items` — `id`, `category_id`, `name`, `price`, `image_url`, `is_available`, `kot_printer` (kitchen/bar), `prep_minutes`.
- `restaurant_modifier_groups` — `id`, `name`, `min_select`, `max_select`, `required`.
- `restaurant_modifiers` — `id`, `group_id`, `name`, `price_delta`.
- `restaurant_item_modifier_groups` — link `menu_item_id` ↔ `modifier_group_id`.
- `restaurant_recipes` — `id`, `menu_item_id`, `product_id` (FK to existing `products`), `quantity`, `unit` — drives stock deduction on order completion.
- `restaurant_orders` — `id`, `order_no`, `type` (dine_in/takeaway/delivery), `table_id`, `customer_id`, `delivery_address`, `status` (open/sent/served/paid/void), `subtotal`, `tax`, `service_charge`, `discount`, `total`, `opened_by`, `closed_at`.
- `restaurant_order_items` — `id`, `order_id`, `menu_item_id`, `qty`, `unit_price`, `modifiers` (jsonb), `note`, `kot_status` (new/sent/preparing/ready/served), `kot_batch`.
- `restaurant_payments` — `id`, `order_id`, `method`, `amount`, `paid_by`, `paid_at` (supports split).
- DB trigger on `restaurant_order_items` insert/update marks `kot_batch`; trigger on `restaurant_orders.status='paid'` deducts recipe ingredients from `products.stock` and writes journal entries via existing accounting flow.

### 2. Frontend

New route + app registry entry:

- `src/lib/appRegistry.ts` — add `restaurant` app, new group **`Restaurant`** (icon `UtensilsCrossed`, warm orange gradient to fit existing style).
- `src/pages/admin/Desktop.tsx` — register `Restaurant` in `APP_GROUPS` + `GROUP_META`.
- `src/App.tsx` — add `/admin/restaurant`, `/admin/restaurant/menu`, `/admin/restaurant/tables`, `/admin/restaurant/recipes` routes.

New pages under `src/pages/admin/restaurant/`:

- `RestaurantPOS.tsx` — main shell: left = floor plan / order-type tabs, center = active order ticket, right = menu grid with modifier dialog. F2 send to kitchen (KOT), F3 print bill, F4 pay.
- `FloorPlan.tsx` — drag-positioned table tiles, color-coded by status, click to open/select order.
- `MenuManager.tsx` — CRUD categories, items, modifier groups, link modifiers to items.
- `Recipes.tsx` — map menu items to existing products with qty/unit for stock deduction.
- Reusable components: `OrderTicket.tsx`, `MenuItemCard.tsx`, `ModifierDialog.tsx`, `KOTPrintPreview.tsx`, `SplitPaymentDialog.tsx`.

### 3. Workflows

- **Dine-in**: select table → add items → F2 sends KOT (prints to kitchen, marks items `sent`) → additional rounds create new KOT batches → F4 opens split payment dialog → on paid, table returns to free.
- **Takeaway**: skip table, optional customer phone, print KOT + receipt together.
- **Delivery**: pick contact + address (reuses `contacts`), assign rider note, same KOT flow.
- **KOT printing**: reuses existing `kioskPrint.ts` with a kitchen-only template (no prices, large item names, modifier lines, table#/order#).
- **Split bills & multi-payment**: dialog allows multiple `restaurant_payments` rows (cash/mobile/card), auto-balances last entry, integrates with existing 571/521 accounting triggers.
- **Recipes**: on `paid`, trigger walks `restaurant_recipes` for each item × qty and decrements `products.stock`; respects negative-stock allowed rule.

### 4. Styling

Matches existing desktop look — same `AppTile`/`AppWindow` shell, semantic tokens from `index.css`, no custom colors in components. Restaurant group uses `from-orange-500 to-red-600`.

### Technical notes

- Reuses: `pos_users` for `opened_by`, `contacts` for customers, `products` + stock triggers via recipes, `kioskPrint.ts` for printing, `QuickPaymentDialog` pattern for post-sale F3 print prompt.
- Offline: queries via existing local-first pattern (`db/queries/*`), with cloud fallback. Online order numbers come from a Postgres sequence `restaurant_order_no_seq`.
- Accounting: paid orders post to existing 701 (sales) / 411x (credit) / 571/521 (cash/mobile) via a new `restaurant_orders` AFTER UPDATE trigger that mirrors the POS trigger structure.
- All new tables get explicit `GRANT` + RLS policies scoped to authenticated POS users (admin full access, cashiers their store).
