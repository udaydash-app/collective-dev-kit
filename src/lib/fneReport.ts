import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { formatDate, formatDateTime } from '@/lib/utils';

// PDF-safe currency formatting: jsPDF standard fonts cannot render the
// narrow no-break spaces produced by fr-CI grouping, so use plain spaces.
const money = (amount: number | null | undefined): string => {
  const value = amount ?? 0;
  const hasDecimals = value % 1 !== 0;
  return value
    .toLocaleString('fr-FR', {
      minimumFractionDigits: hasDecimals ? 2 : 0,
      maximumFractionDigits: 2,
    })
    .replace(/[\u00A0\u202F\u2009]/g, ' ');
};
import { fetchCompanySettings, addPdfHeader } from '@/lib/pdfBranding';

export interface FneLine {
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface FneInvoice {
  id: string;
  number: string;
  date: string;
  customerName: string;
  lines: FneLine[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
}

export interface FneResult {
  invoices: FneInvoice[];
  target: number;
  achieved: number;
  difference: number;
}

const num = (v: any) => {
  const n = typeof v === 'number' ? v : parseFloat(v ?? '0');
  return Number.isFinite(n) ? n : 0;
};

/** Map a raw pos_transactions row into a full invoice with line items. */
export function mapTransactionToInvoice(t: any): FneInvoice {
  const rawItems: any[] = Array.isArray(t.items) ? t.items : [];
  const lines: FneLine[] = rawItems
    .filter((i) => i && (i.name || i.productName))
    .map((i) => {
      const qty = Math.abs(num(i.quantity));
      const base =
        i.customPrice != null && i.customPrice !== '' && num(i.customPrice) !== 0
          ? Math.abs(num(i.customPrice))
          : num(i.price ?? i.unit_price);
      const unitPrice = Math.max(0, base - Math.abs(num(i.itemDiscount)));
      return {
        name: i.name || i.productName || 'Item',
        quantity: qty,
        unitPrice,
        lineTotal: unitPrice * qty,
      };
    });

  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  const discount = num(t.discount ?? t.discount_amount);
  const tax = num(t.tax ?? t.tax_amount ?? t.timbre ?? t.stamp_duty);

  return {
    id: t.id,
    number: t.transaction_number || t.id?.slice(0, 8) || '—',
    date: t.created_at,
    customerName: t.contacts?.name || t.customer_name || 'Walk-in',
    lines,
    subtotal,
    discount,
    tax,
    total: num(t.total),
  };
}

/** Map a purchase row (with purchase_items) into the shared invoice shape. */
export function mapPurchaseToInvoice(p: any): FneInvoice {
  const rawItems: any[] = Array.isArray(p.purchase_items) ? p.purchase_items : [];
  const lines: FneLine[] = rawItems.map((i) => {
    const qty = Math.abs(num(i.quantity));
    const unitPrice = num(i.unit_cost);
    return {
      name: i.products?.name || i.product_name || 'Item',
      quantity: qty,
      unitPrice,
      lineTotal: num(i.total_cost) || unitPrice * qty,
    };
  });

  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  const total = num(p.total_amount);

  return {
    id: p.id,
    number: p.purchase_number || p.id?.slice(0, 8) || '—',
    date: p.purchased_at || p.created_at,
    customerName: p.supplier_name || 'Unknown supplier',
    lines,
    subtotal,
    discount: 0,
    tax: Math.max(0, total - subtotal),
    total,
  };
}

/** Map an expense row into the shared invoice shape. */
export function mapExpenseToInvoice(e: any): FneInvoice {
  const total = num(e.amount);
  return {
    id: e.id,
    number: (e.id as string)?.slice(0, 8).toUpperCase() || '—',
    date: e.expense_date || e.created_at,
    customerName: e.contacts?.name || e.category || 'Expense',
    lines: [
      {
        name: e.description || e.category || 'Expense',
        quantity: 1,
        unitPrice: total,
        lineTotal: total,
      },
    ],
    subtotal: total,
    discount: 0,
    tax: 0,
    total,
  };
}

/**
 * Randomly select records whose total lands as close as possible to the
 * target without exceeding it. Never modifies any amount.
 */
export function selectFneFromInvoices(invoices: FneInvoice[], target: number): FneResult {
  const pool = invoices.filter((inv) => inv.total > 0);

  // Fisher-Yates shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const chosen: FneInvoice[] = [];
  let achieved = 0;
  const remaining: FneInvoice[] = [];

  for (const inv of pool) {
    if (achieved + inv.total <= target) {
      chosen.push(inv);
      achieved += inv.total;
    } else {
      remaining.push(inv);
    }
  }

  // Second pass: fill the leftover gap with the largest records that still fit
  remaining.sort((a, b) => b.total - a.total);
  for (const inv of remaining) {
    if (achieved + inv.total <= target) {
      chosen.push(inv);
      achieved += inv.total;
    }
  }

  chosen.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return { invoices: chosen, target, achieved, difference: target - achieved };
}

export function selectFneInvoices(transactions: any[], target: number): FneResult {
  return selectFneFromInvoices(transactions.map(mapTransactionToInvoice), target);
}

/** Random date/time string inside [startDate, endDate] (yyyy-MM-dd inputs). */
function randomDateInPeriod(startDate: string, endDate: string): string {
  const s = new Date(`${startDate}T00:00:00`).getTime();
  const e = new Date(`${endDate}T23:59:59`).getTime();
  const t = s + Math.random() * Math.max(0, e - s);
  return new Date(t).toISOString();
}

/**
 * Fill the target using in-period records first; if the target is not reached,
 * borrow older records and display their dates inside the selected period.
 */
export function selectFneWithFallback(
  inPeriod: FneInvoice[],
  prior: FneInvoice[],
  target: number,
  startDate: string,
  endDate: string
): FneResult {
  const base = selectFneFromInvoices(inPeriod, target);
  if (base.difference <= 0 || !prior.length) return base;

  const used = new Set(base.invoices.map((i) => i.id));
  const pool = prior.filter((i) => i.total > 0 && !used.has(i.id));

  // Shuffle then greedy-fit, largest-first second pass
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  let achieved = base.achieved;
  const extra: FneInvoice[] = [];
  const rest: FneInvoice[] = [];
  for (const inv of pool) {
    if (achieved + inv.total <= target) {
      extra.push(inv);
      achieved += inv.total;
    } else {
      rest.push(inv);
    }
  }
  rest.sort((a, b) => b.total - a.total);
  for (const inv of rest) {
    if (achieved + inv.total <= target) {
      extra.push(inv);
      achieved += inv.total;
    }
  }

  const remapped = extra.map((inv) => ({ ...inv, date: randomDateInPeriod(startDate, endDate) }));
  const invoices = [...base.invoices, ...remapped].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return { invoices, target, achieved, difference: target - achieved };
}


export type FneGroupBy = 'none' | 'customer' | 'product';

export interface FneGroupRow {
  name: string;
  quantity: number;
  count: number;
  total: number;
}

/** Group the selected records by customer/party or by product line. */
export function buildFneGroups(invoices: FneInvoice[], by: FneGroupBy): FneGroupRow[] {
  if (by === 'none') return [];
  const map = new Map<string, FneGroupRow>();

  if (by === 'customer') {
    for (const inv of invoices) {
      const key = inv.customerName || 'Unknown';
      const row = map.get(key) || { name: key, quantity: 0, count: 0, total: 0 };
      row.count += 1;
      row.quantity += inv.lines.reduce((s, l) => s + l.quantity, 0);
      row.total += inv.total;
      map.set(key, row);
    }
  } else {
    for (const inv of invoices) {
      for (const l of inv.lines) {
        const key = l.name || 'Item';
        const row = map.get(key) || { name: key, quantity: 0, count: 0, total: 0 };
        row.count += 1;
        row.quantity += l.quantity;
        row.total += l.lineTotal;
        map.set(key, row);
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

export interface FneMeta {
  storeName: string;
  startDate: string;
  endDate: string;
  /** e.g. "Invoice", "Purchase", "Expense" */
  docLabel?: string;
  /** e.g. "Customer", "Supplier", "Payee" */
  partyLabel?: string;
  /** Report title suffix, e.g. "Sales" */
  sourceLabel?: string;
  /** Optional grouped breakdown to include in exports */
  groupBy?: FneGroupBy;
}


export async function exportFnePdf(result: FneResult, meta: FneMeta) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const settings = await fetchCompanySettings();
  let y = await addPdfHeader(doc, settings, { startY: 10 });

  const pageWidth = doc.internal.pageSize.getWidth();
  const docLabel = meta.docLabel || 'Invoice';
  const partyLabel = meta.partyLabel || 'Customer';
  const title = meta.sourceLabel ? `FNE Report - ${meta.sourceLabel}` : 'FNE Report';

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(title, pageWidth / 2, y, { align: 'center' });
  y += 6;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `${meta.storeName}  |  ${formatDate(meta.startDate)} - ${formatDate(meta.endDate)}`,
    pageWidth / 2,
    y,
    { align: 'center' }
  );
  y += 4;
  doc.text(`Generated on ${formatDateTime(new Date())}`, pageWidth / 2, y, { align: 'center' });
  y += 6;

  autoTable(doc, {
    startY: y,
    head: [['Target Amount', 'Achieved Total', 'Difference', `${docLabel}s`]],
    body: [[
      money(result.target),
      money(result.achieved),
      money(result.difference),
      String(result.invoices.length),
    ]],
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [34, 197, 94] },
    theme: 'grid',
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  autoTable(doc, {
    startY: y,
    head: [['#', `${docLabel} No`, 'Date', partyLabel, 'Total (FCFA)']],
    body: result.invoices.map((inv, idx) => [
      String(idx + 1),
      inv.number,
      formatDate(inv.date),
      inv.customerName,
      money(inv.total),
    ]),
    foot: [['', '', '', 'TOTAL', money(result.achieved)]],
    styles: { fontSize: 8, cellPadding: 1.6 },
    headStyles: { fillColor: [30, 41, 59] },
    footStyles: { fillColor: [241, 245, 249], textColor: 20, fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 10 }, 4: { halign: 'right' } },
    theme: 'grid',
  });

  // One page per invoice
  for (const inv of result.invoices) {
    doc.addPage();
    let iy = 16;
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(settings?.company_name || meta.storeName, pageWidth / 2, iy, { align: 'center' });
    iy += 6;
    doc.setFontSize(11);
    doc.text(`${docLabel} ${inv.number}`, pageWidth / 2, iy, { align: 'center' });
    iy += 8;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Date: ${formatDateTime(inv.date)}`, 14, iy);
    doc.text(`${partyLabel}: ${inv.customerName}`, pageWidth - 14, iy, { align: 'right' });
    iy += 5;

    autoTable(doc, {
      startY: iy,
      head: [['Description', 'Qty', 'Unit Price', 'Line Total']],
      body: inv.lines.map((l) => [
        l.name,
        String(l.quantity),
        money(l.unitPrice),
        money(l.lineTotal),
      ]),
      styles: { fontSize: 8, cellPadding: 1.6 },
      headStyles: { fillColor: [30, 41, 59] },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
      theme: 'grid',
    });

    let sy = (doc as any).lastAutoTable.finalY + 6;
    const rows: Array<[string, number]> = [
      ['Subtotal', inv.subtotal],
      ['Discount', inv.discount],
      ['Timbre / Tax', inv.tax],
      ['Total', inv.total],
    ];
    doc.setFontSize(9);
    rows.forEach(([label, value], i) => {
      doc.setFont('helvetica', i === rows.length - 1 ? 'bold' : 'normal');
      doc.text(label, pageWidth - 70, sy);
      doc.text(money(value), pageWidth - 14, sy, { align: 'right' });
      sy += 5;
    });
  }

  doc.save(`FNE-${meta.sourceLabel || 'Sales'}-Report-${meta.startDate}-to-${meta.endDate}.pdf`);
}

export function exportFneExcel(result: FneResult, meta: FneMeta) {
  const wb = XLSX.utils.book_new();
  const docLabel = meta.docLabel || 'Invoice';
  const partyLabel = meta.partyLabel || 'Customer';

  const summaryRows: any[][] = [
    [meta.sourceLabel ? `FNE Report - ${meta.sourceLabel}` : 'FNE Report'],
    ['Store', meta.storeName],
    ['Period', `${formatDate(meta.startDate)} - ${formatDate(meta.endDate)}`],
    ['Generated', formatDateTime(new Date())],
    [],
    ['Target Amount', result.target],
    ['Achieved Total', result.achieved],
    ['Difference', result.difference],
    [`${docLabel} Count`, result.invoices.length],
    [],
    ['#', `${docLabel} No`, 'Date', partyLabel, 'Total'],
    ...result.invoices.map((inv, i) => [
      i + 1,
      inv.number,
      formatDate(inv.date),
      inv.customerName,
      inv.total,
    ]),
    ['', '', '', 'TOTAL', result.achieved],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), 'Summary');

  const lineRows: any[][] = [
    [`${docLabel} No`, 'Date', partyLabel, 'Description', 'Qty', 'Unit Price', 'Line Total', `${docLabel} Total`],
  ];
  result.invoices.forEach((inv) => {
    if (!inv.lines.length) {
      lineRows.push([inv.number, formatDate(inv.date), inv.customerName, '—', 0, 0, 0, inv.total]);
      return;
    }
    inv.lines.forEach((l) => {
      lineRows.push([
        inv.number,
        formatDate(inv.date),
        inv.customerName,
        l.name,
        l.quantity,
        l.unitPrice,
        l.lineTotal,
        inv.total,
      ]);
    });
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(lineRows), `${docLabel}s`);

  XLSX.writeFile(wb, `FNE-${meta.sourceLabel || 'Sales'}-Report-${meta.startDate}-to-${meta.endDate}.xlsx`);
}
