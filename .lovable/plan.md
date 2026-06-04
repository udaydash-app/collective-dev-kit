## Margin Simulator

A new app under the **Analytics** group that lets you enter a target profit % (markup on cost) and instantly see the suggested sale price for every product and variant with a cost, with search and comparison to current prices.

### Where it lives
- New route: `/admin/margin-simulator`
- New page: `src/pages/admin/MarginSimulator.tsx`
- Registered in `src/lib/appRegistry.ts` under group **Analytics** (icon: `Calculator` or `Percent`, gradient consistent with other Analytics tiles)

### UI
- Header: title + description
- Controls row:
  - Numeric input: **Target profit %** (markup on cost), default 50, with a slider 0–500
  - Search box: filter by product name / SKU / barcode / category
  - Category filter dropdown (optional)
  - Sort dropdown: name, cost asc/desc, delta asc/desc
  - Export CSV button
- Results table (virtualized / paginated, sticky header, horizontal scroll per project pattern):
  - Product (name + variant label if applicable)
  - SKU / Barcode
  - Category
  - Effective Cost (CIF + local charges) — uses `getEffectiveCost` / `getVariantEffectiveCost` from `src/lib/utils.ts`
  - Current Sale Price
  - **Simulated Price** = `cost × (1 + %/100)` — highlighted column
  - Delta (Simulated − Current), colored green if increase / red if decrease
  - Current achieved markup % (for quick reference)
- Empty state when no products with cost; loading skeletons during fetch
- All currency via `formatCurrency`; dd/MM/yyyy where any date is shown

### Data
- Fetch `products` (id, name, sku, barcode, price, cost_price, local_charges, category_id, has_variants) and `product_variants` (id, product_id, name, sku, barcode, price, cost_price)
- Join categories for display + filter
- Build one row per product without variants and one row per variant
- Skip rows where effective cost is 0 / null (toggleable "show items with no cost")
- Pure client-side recomputation when the % changes (no DB writes)

### Read-only
No schema changes, no migrations, no writes. This is a calculator/report.

### Files to add / edit
- Add `src/pages/admin/MarginSimulator.tsx`
- Edit `src/lib/appRegistry.ts` — register the new app in the Analytics group
