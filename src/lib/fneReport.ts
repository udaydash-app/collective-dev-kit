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

/**
 * Randomly select invoices whose total lands as close as possible to the
 * target without exceeding it. Never modifies any invoice amount.
 */
export function selectFneInvoices(transactions: any[], target: number): FneResult {
  const pool = transactions
    .map(mapTransactionToInvoice)
    .filter((inv) => inv.total > 0);

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

  // Second pass: fill the leftover gap with the largest invoices that still fit
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

export interface FneMeta {
  storeName: string;
  startDate: string;
  endDate: string;
}

export async function exportFnePdf(result: FneResult, meta: FneMeta) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const settings = await fetchCompanySettings();
  let y = await addPdfHeader(doc, settings, { startY: 10 });

  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('FNE Report', pageWidth / 2, y, { align: 'center' });
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
    head: [['Target Amount', 'Achieved Total', 'Difference', 'Invoices']],
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
    head: [['#', 'Invoice No', 'Date', 'Customer', 'Total (FCFA)']],
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
    doc.text(`Invoice ${inv.number}`, pageWidth / 2, iy, { align: 'center' });
    iy += 8;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Date: ${formatDateTime(inv.date)}`, 14, iy);
    doc.text(`Customer: ${inv.customerName}`, pageWidth - 14, iy, { align: 'right' });
    iy += 5;

    autoTable(doc, {
      startY: iy,
      head: [['Product', 'Qty', 'Unit Price', 'Line Total']],
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

  doc.save(`FNE-Report-${meta.startDate}-to-${meta.endDate}.pdf`);
}

export function exportFneExcel(result: FneResult, meta: FneMeta) {
  const wb = XLSX.utils.book_new();

  const summaryRows: any[][] = [
    ['FNE Report'],
    ['Store', meta.storeName],
    ['Period', `${formatDate(meta.startDate)} - ${formatDate(meta.endDate)}`],
    ['Generated', formatDateTime(new Date())],
    [],
    ['Target Amount', result.target],
    ['Achieved Total', result.achieved],
    ['Difference', result.difference],
    ['Invoice Count', result.invoices.length],
    [],
    ['#', 'Invoice No', 'Date', 'Customer', 'Total'],
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
    ['Invoice No', 'Date', 'Customer', 'Product', 'Qty', 'Unit Price', 'Line Total', 'Invoice Total'],
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
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(lineRows), 'Invoices');

  XLSX.writeFile(wb, `FNE-Report-${meta.startDate}-to-${meta.endDate}.xlsx`);
}
