# FNE Report in Close Day Report

Add a new report type "FNE" to the Close Day Report screen. You enter a period and a target amount, and the system randomly picks real existing sales invoices from that period so their total lands as close as possible to the amount, then shows a report of the picked invoices with full invoice detail and lets you export everything to PDF and Excel.

## How it works for the user

1. In Report Type, pick "FNE".
2. Set start and end date (existing date fields) and enter a target amount in a new "Target Amount" field.
3. Click Generate. A "Re-shuffle" button lets you regenerate a different random selection with the same inputs.
4. Result shows:
   - Summary card: target amount, achieved total, difference, number of invoices selected.
   - Summary table: invoice number, date, customer, total.
   - Full detail for each selected invoice: invoice number, date, customer, line items (product, qty, unit price, line total), subtotal, discount, timbre/tax, total.
5. Two export buttons: Export PDF and Export Excel.

## Selection logic

- Load all POS transactions in the period for the selected store (paged, so the 1000-row cap is not hit).
- Shuffle them randomly, then greedily add invoices while the running total stays at or under the target; keep scanning the remaining ones for smaller invoices that still fit.
- Never modify an invoice amount and never write anything to the database — the result is closest-possible, read-only.
- If no invoice fits (target smaller than the cheapest sale), show a clear empty-state message.

## Exports

- PDF (jspdf + jspdf-autotable, already in the project): company branding header, period, target vs achieved summary, a summary table of all selected invoices, then one page per invoice with its line items. Numbers use the existing FCFA formatting and dates use dd/MM/yyyy.
- Excel (xlsx, already in the project): sheet 1 "Summary" (target, achieved, difference, count + invoice list), sheet 2 "Invoices" (one row per line item with invoice number, date, customer, product, qty, unit price, line total).

## Technical notes

- `src/pages/admin/CloseDayReport.tsx`: add `'fne'` to the `ReportType` union and to the Select options; add `targetAmount` state and an amount input shown only for FNE; add an `fne` branch in the report query that pages through `pos_transactions` (id, transaction_number, created_at, total, items, customer_id, contacts:customer_id(name), discount, tax fields) and runs the selection; add an FNE render block and the two export handlers.
- Extract the FNE selection + export helpers into `src/lib/fneReport.ts` to keep the page file manageable.
- Reuse `formatCurrency` / `formatDate` from `src/lib/utils` and `fetchCompanySettings` / `addPdfHeader` from `src/lib/pdfBranding` for the PDF header.
- PDF is generated with autoTable (vector text, not canvas), so file size stays well under 1MB.
