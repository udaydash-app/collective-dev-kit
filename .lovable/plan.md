## Goal
For every distinct product linked to purchase `PUR-45CF8ED201` (198 rows), split the current `cost_price` on the **products master** into a true CIF cost and a local charges component using a 77.94% markup unwind.

## Formula (applied per product)
```
new_local_charges = round( current_cost_price * (0.7794 / 1.7794), 2 )
new_cost_price    = round( current_cost_price - new_local_charges, 2 )
                  ≈ current_cost_price / 1.7794
```

Example: cost 1 779.40 → local_charges 779.40, cost_price 1 000.00.

## Scope
- Table: `public.products`
- Rows: only products present in `purchase_items` of the purchase whose `purchase_number = 'PUR-45CF8ED201'` (198 products).
- Untouched: `product_variants`, other purchases, and any product not in this purchase.
- Purchase_items rows themselves are not modified (all their `local_charges` are already 0 and `unit_cost` on the purchase snapshot stays as historical record).

## Execution
Single `UPDATE` via the data-change tool:

```sql
WITH targets AS (
  SELECT DISTINCT pi.product_id
  FROM purchase_items pi
  JOIN purchases p ON p.id = pi.purchase_id
  WHERE p.purchase_number = 'PUR-45CF8ED201'
)
UPDATE public.products pr
SET
  local_charges = ROUND( (pr.cost_price * 0.7794 / 1.7794)::numeric, 2 ),
  cost_price    = ROUND( (pr.cost_price / 1.7794)::numeric, 2 ),
  updated_at    = now()
FROM targets
WHERE pr.id = targets.product_id
  AND pr.cost_price IS NOT NULL
  AND pr.cost_price > 0;
```

## Verification after run
- Spot-check 5 products: `new_cost_price + new_local_charges` must equal the original `cost_price` (±0.01 rounding).
- `getEffectiveCost()` (used across reports/POS) will return the same landed cost as before, so margins, COGS, P&L are unaffected — only the CIF vs local-charges split changes.

## Notes / risks
- Rounding uses 2 decimals; tiny (≤ 0.01) rounding drift per product is expected.
- Historical `purchase_items.unit_cost` is not changed, so past purchase totals stay intact.
- No code changes required; this is a one-shot data update.
