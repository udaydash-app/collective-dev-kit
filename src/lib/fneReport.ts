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
    head: [[`${docLabel}s Selected`]],
    body: [[String(result.invoices.length)]],
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

  // Optional grouped breakdown
  const groups = buildFneGroups(result.invoices, meta.groupBy || 'none');
  if (groups.length) {
    const byProduct = meta.groupBy === 'product';
    doc.addPage();
    autoTable(doc, {
      startY: 16,
      head: [[
        '#',
        byProduct ? 'Product' : partyLabel,
        'Qty',
        byProduct ? `${docLabel} Lines` : `${docLabel}s`,
        'Total (FCFA)',
      ]],
      body: groups.map((g, i) => [String(i + 1), g.name, String(g.quantity), String(g.count), money(g.total)]),
      foot: [['', 'TOTAL', '', '', money(groups.reduce((s, g) => s + g.total, 0))]],
      styles: { fontSize: 8, cellPadding: 1.6 },
      headStyles: { fillColor: [34, 197, 94] },
      footStyles: { fillColor: [241, 245, 249], textColor: 20, fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: 10 }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
      theme: 'grid',
    });
  }

  // ---- Receipt-style slips (same look as POS bills), tiled on A4 ----
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 8;
  const gutter = 5;
  const cols = 3;
  const colW = (pageWidth - margin * 2 - gutter * (cols - 1)) / cols;
  const topY = 14;
  const bottomY = pageHeight - 10;
  const storeTitle = (settings?.company_name || meta.storeName || '').toUpperCase();

  // Build the drawing instructions for one receipt so height can be measured
  type Op =
    | { t: 'text'; s: string; align: 'left' | 'center' | 'right'; bold?: boolean; size: number; h: number }
    | { t: 'row'; l: string; r: string; bold?: boolean; size: number; h: number }
    | { t: 'line'; dashed?: boolean; h: number };

  const buildOps = (inv: FneInvoice): Op[] => {
    const ops: Op[] = [];
    const wrap = (s: string, size: number) => {
      doc.setFontSize(size);
      return doc.splitTextToSize(s, colW - 4) as string[];
    };

    wrap(storeTitle, 9).forEach((s) =>
      ops.push({ t: 'text', s, align: 'center', bold: true, size: 9, h: 4 })
    );
    ops.push({ t: 'text', s: `${docLabel}: ${inv.number}`, align: 'center', bold: false, size: 7, h: 3.4 });
    ops.push({ t: 'text', s: formatDateTime(inv.date), align: 'center', bold: false, size: 7, h: 3.4 });
    wrap(`${partyLabel}: ${inv.customerName}`, 7).forEach((s) =>
      ops.push({ t: 'text', s, align: 'center', bold: true, size: 7, h: 3.4 })
    );
    ops.push({ t: 'line', h: 3 });

    inv.lines.forEach((l) => {
      wrap(l.name, 7).forEach((s) => ops.push({ t: 'text', s, align: 'left', size: 7, h: 3.4 }));
      ops.push({
        t: 'row',
        l: `${l.quantity} x ${money(l.unitPrice)}`,
        r: money(l.lineTotal),
        bold: true,
        size: 7,
        h: 3.6,
      });
    });

    ops.push({ t: 'line', h: 3 });
    ops.push({ t: 'row', l: 'Subtotal:', r: money(inv.subtotal), size: 7, h: 3.6 });
    if (inv.tax > 0) ops.push({ t: 'row', l: 'Timbre:', r: money(inv.tax), size: 7, h: 3.6 });
    if (inv.discount > 0)
      ops.push({ t: 'row', l: 'Discount:', r: `-${money(inv.discount)}`, size: 7, h: 3.6 });
    ops.push({ t: 'line', h: 2.5 });
    ops.push({ t: 'row', l: 'TOTAL:', r: money(inv.total), bold: true, size: 9, h: 5 });
    ops.push({ t: 'line', dashed: true, h: 3 });
    ops.push({ t: 'text', s: 'Thank you for shopping with us!', align: 'center', size: 6, h: 3 });
    return ops;
  };

  const drawOps = (ops: Op[], x: number, y: number): number => {
    let cy2 = y;
    const left = x + 2;
    const right = x + colW - 2;
    for (const op of ops) {
      if (op.t === 'line') {
        doc.setDrawColor(120, 120, 120);
        doc.setLineWidth(0.2);
        if (op.dashed && (doc as any).setLineDashPattern) (doc as any).setLineDashPattern([0.8, 0.8], 0);
        doc.line(left, cy2, right, cy2);
        if (op.dashed && (doc as any).setLineDashPattern) (doc as any).setLineDashPattern([], 0);
        cy2 += op.h;
        continue;
      }
      doc.setFontSize(op.size);
      doc.setFont('courier', op.bold ? 'bold' : 'normal');
      if (op.t === 'text') {
        const tx = op.align === 'center' ? x + colW / 2 : op.align === 'right' ? right : left;
        doc.text(op.s, tx, cy2, { align: op.align });
      } else {
        doc.text(op.l, left, cy2);
        doc.text(op.r, right, cy2, { align: 'right' });
      }
      cy2 += op.h;
    }
    return cy2;
  };

  doc.addPage();
  let col = 0;
  let cy = topY;
  let rowMaxBottom = topY;

  for (const inv of result.invoices) {
    const ops = buildOps(inv);
    const height = ops.reduce((s, o) => s + o.h, 0) + 6;

    if (cy + height > bottomY) {
      // move to next column, or next page when the row is full
      col += 1;
      if (col >= cols) {
        doc.addPage();
        col = 0;
        rowMaxBottom = topY;
      }
      cy = topY;
    }

    const x = margin + col * (colW + gutter);
    const end = drawOps(ops, x, cy);
    cy = end + 6;
    rowMaxBottom = Math.max(rowMaxBottom, cy);
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

  const groups = buildFneGroups(result.invoices, meta.groupBy || 'none');
  if (groups.length) {
    const byProduct = meta.groupBy === 'product';
    const groupRows: any[][] = [
      ['#', byProduct ? 'Product' : partyLabel, 'Qty', byProduct ? `${docLabel} Lines` : `${docLabel}s`, 'Total'],
      ...groups.map((g, i) => [i + 1, g.name, g.quantity, g.count, g.total]),
      ['', 'TOTAL', '', '', groups.reduce((s, g) => s + g.total, 0)],
    ];
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet(groupRows),
      byProduct ? 'By Product' : `By ${partyLabel}`,
    );
  }


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
