/**
 * Z Report — end-of-day summary printed on thermal receipt paper.
 * Uses a hidden iframe (or Electron print bridge) same as kioskPrint.
 */

export interface ZReportCategory {
  category: string;
  quantity: number;
  netSales: number;
}

export interface ZReportDiscount {
  name: string;
  count: number;
  amount: number;
}

export interface ZReportData {
  storeName: string;
  date: Date;
  cashierName?: string;
  openingCash: number;
  // Sales & taxes
  totalNetSales: number;
  tax: number;
  totalSales: number;
  // Categories
  categories: ZReportCategory[];
  // Payments
  payments: { label: string; amount: number }[];
  totalPayments: number;
  // Discounts
  discounts: ZReportDiscount[];
  // Cash reconciliation
  expectedCash: number;
  closingCash?: number;
  cashDifference?: number;
  // Other flows
  purchases?: number;
  expenses?: number;
  supplierPayments?: number;
  paymentReceipts?: number;
  transactionCount: number;
}

function fmt(n: number): string {
  return (Math.round(n) || 0).toLocaleString('fr-CI') + ' FCFA';
}

function fmtDate(d: Date): string {
  return d.toLocaleString('en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function generateZReportHTML(data: ZReportData): string {
  const row = (l: string, r: string, bold = false) =>
    `<div class="row${bold ? ' bold' : ''}"><span>${l}</span><span>${r}</span></div>`;

  const section = (title: string, inner: string) =>
    `<div class="section"><div class="section-title">${title}</div>${inner}</div>`;

  const salesTaxes = [
    row('Total Net Sales', fmt(data.totalNetSales)),
    row('Tax', fmt(data.tax)),
    `<div class="hr"></div>`,
    row('Total Sales', fmt(data.totalSales), true),
  ].join('');

  const catsRows = [
    `<div class="row head"><span>Category</span><span>Quantity&nbsp;&nbsp;Net Sales</span></div>`,
    ...data.categories.map(c => `<div class="row"><span>${c.category}</span><span>(${c.quantity})&nbsp;&nbsp;${fmt(c.netSales)}</span></div>`),
    `<div class="hr"></div>`,
    row('Total Net Sales', fmt(data.totalNetSales), true),
  ].join('');

  const paymentsRows = [
    ...data.payments.map(p => row(p.label, fmt(p.amount))),
    `<div class="hr"></div>`,
    row('Total Payments', fmt(data.totalPayments), true),
    row('Total Payments - Total Sales =', fmt(data.totalPayments - data.totalSales), true),
  ].join('');

  const cashRecon = [
    row('Opening Cash', fmt(data.openingCash)),
    row('Expected Cash', fmt(data.expectedCash)),
    ...(data.closingCash !== undefined ? [row('Closing Cash', fmt(data.closingCash))] : []),
    ...(data.cashDifference !== undefined ? [row('Difference', (data.cashDifference >= 0 ? '+' : '-') + fmt(Math.abs(data.cashDifference)), true)] : []),
  ].join('');

  const otherFlows = [
    ...(data.purchases ? [row('Purchases', fmt(data.purchases))] : []),
    ...(data.expenses ? [row('Expenses', fmt(data.expenses))] : []),
    ...(data.supplierPayments ? [row('Supplier Payments', fmt(data.supplierPayments))] : []),
    ...(data.paymentReceipts ? [row('Receipts', fmt(data.paymentReceipts))] : []),
  ].join('');

  const discountRows = data.discounts.length
    ? [
        `<div class="row head"><span>Discount Name</span><span>Count&nbsp;&nbsp;Amount</span></div>`,
        ...data.discounts.map(d => `<div class="row"><span>${d.name}</span><span>${d.count}&nbsp;&nbsp;${fmt(d.amount)}</span></div>`),
      ].join('')
    : `<div class="row"><span>No discounts applied</span><span></span></div>`;

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
@page{size:72mm auto;margin:0}
html,body{width:72mm;margin:0;padding:0;background:#fff;color:#000}
body{font-family:"Courier New",monospace;font-size:11px;line-height:1.3;padding:2mm 2.5mm 3mm 2.5mm;font-weight:900;-webkit-print-color-adjust:exact;print-color-adjust:exact}
*{margin:0;padding:0;box-sizing:border-box;color:#000}
.header{display:flex;justify-content:space-between;align-items:baseline;border:1px solid #000;padding:3px 4px;font-weight:900;font-size:13px;margin-bottom:6px}
.section{margin-bottom:8px}
.section-title{text-align:center;font-weight:900;font-size:11.5px;padding:3px 0;border-top:1px solid #000;border-bottom:1px solid #000;margin-bottom:4px;letter-spacing:0.5px}
.row{display:grid;grid-template-columns:1fr auto;gap:6px;padding:1px 0}
.row.head{border-bottom:1px solid #000;padding-bottom:2px;margin-bottom:2px;font-weight:900}
.row span:last-child{text-align:right;white-space:nowrap}
.row.bold{font-weight:900;border-top:1px solid #000;padding-top:2px;margin-top:2px}
.hr{border-top:1px dashed #000;margin:3px 0}
.foot{text-align:center;font-size:10px;margin-top:6px;border-top:1px dashed #000;padding-top:4px}
</style></head><body>
<div class="header"><span>Z Report</span><span>${fmtDate(data.date)}</span></div>
${data.cashierName ? `<div style="text-align:center;font-size:10.5px;margin-bottom:6px">Cashier: ${data.cashierName}${data.storeName ? ' &middot; ' + data.storeName : ''}</div>` : ''}
${section('SALES AND TAXES SUMMARY', salesTaxes)}
${data.categories.length ? section('SALES CATEGORIES', catsRows) : ''}
${section('PAYMENT DETAILS', paymentsRows)}
${section('CASH RECONCILIATION', cashRecon)}
${otherFlows ? section('OTHER FLOWS', otherFlows) : ''}
${section('TOTAL DISCOUNTS', discountRows)}
<div class="foot">Transactions: ${data.transactionCount}<br/>-- End of Day --</div>
</body></html>`;
}

let zPrintQueue: Promise<void> = Promise.resolve();

export function printZReport(data: ZReportData): Promise<void> {
  zPrintQueue = zPrintQueue.catch(() => {}).then(() => doPrint(data));
  return zPrintQueue;
}

async function doPrint(data: ZReportData): Promise<void> {
  const html = generateZReportHTML(data);

  if (typeof window !== 'undefined' && (window as any).electron?.print) {
    try {
      await (window as any).electron.print(html);
      return;
    } catch (e) {
      // fall through to iframe
    }
  }

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    try { document.body.removeChild(iframe); } catch {}
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  await new Promise<void>((resolve) => {
    iframe.onload = () => resolve();
    setTimeout(resolve, 250);
  });

  await new Promise<void>((resolve) => {
    const w = iframe.contentWindow;
    if (!w) { try { document.body.removeChild(iframe); } catch {} resolve(); return; }
    let done = false;
    const cleanup = () => {
      if (done) return;
      done = true;
      try { document.body.removeChild(iframe); } catch {}
      resolve();
    };
    w.addEventListener('afterprint', cleanup, { once: true });
    (w as any).onafterprint = cleanup;
    window.addEventListener('focus', () => setTimeout(cleanup, 400), { once: true });
    setTimeout(cleanup, 4000);
    w.focus();
    w.print();
  });
}