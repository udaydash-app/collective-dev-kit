/**
 * Kiosk Mode Direct Printing Utility
 * Works with Chrome --kiosk-printing flag for silent printing
 */

import { formatDateTime } from './utils';

export interface KioskReceiptData {
  storeName: string;
  transactionNumber: string;
  date: Date;
  items: Array<{
    name: string;
    displayName?: string;
    quantity: number;
    price: number;
    customPrice?: number;
    itemDiscount?: number;
  }>;
  subtotal: number;
  tax: number;
  discount?: number;
  total: number;
  paymentMethod: string;
  cashierName?: string;
  customerName?: string;
  customerPhone?: string;
  logoUrl?: string;
  supportPhone?: string;
  customerBalance?: number;
  isUnifiedBalance?: boolean;
}

class KioskPrintService {
  private static instance: KioskPrintService;

  private constructor() {}

  static getInstance(): KioskPrintService {
    if (!KioskPrintService.instance) {
      KioskPrintService.instance = new KioskPrintService();
    }
    return KioskPrintService.instance;
  }

  async printReceipt(data: KioskReceiptData): Promise<void> {
    try {
      const html = this.generateReceiptHTML(data);
      
      // Check if we're in Electron environment
      if (window.electron?.print) {
        await window.electron.print(html);
        return;
      }

      // Use hidden iframe for instant browser printing
      const iframe = document.createElement('iframe');
      iframe.style.position = 'absolute';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentWindow?.document;
      if (!iframeDoc) throw new Error('Failed to access iframe document');

      iframeDoc.open();
      iframeDoc.write(html);
      iframeDoc.close();

      // Print and cleanup immediately
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      
      // Remove iframe immediately after print dialog opens
      requestAnimationFrame(() => document.body.removeChild(iframe));

    } catch (error) {
      throw new Error('Print failed: ' + (error as Error).message);
    }
  }

  private generateReceiptHTML(data: KioskReceiptData): string {
    const formatCurrency = (amount: number) => {
      return amount.toLocaleString('fr-CI', { 
        minimumFractionDigits: 0, 
        maximumFractionDigits: 0 
      }) + ' FCFA';
    };

    const formatDateTime = (date: Date) => {
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    };

    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>@page{size:80mm auto;margin:0}*{margin:0;padding:0;box-sizing:border-box}body{width:80mm;font-family:monospace;font-size:14px;line-height:1.4;color:#000;background:#fff;padding:3mm}.center{text-align:center}.bold{font-weight:bold}.large{font-size:18px}.small{font-size:12px}.mb-1{margin-bottom:4px}.mb-2{margin-bottom:8px}.mt-1{margin-top:4px}.mt-2{margin-top:8px}.border-t{border-top:1px solid #000;padding-top:8px}.border-b{border-bottom:1px solid #000;padding-bottom:8px}.dashed{border-style:dashed}.row{display:flex;justify-content:space-between;margin-bottom:4px}.item{margin-bottom:8px}.item-name{font-weight:bold}.item-details{display:flex;justify-content:space-between;font-size:12px}img{max-height:60px;width:auto;display:block;margin:0 auto 8px}</style></head><body><div class="center mb-2">${data.logoUrl ? `<img src="${data.logoUrl}" alt="Logo">` : ''}<div class="bold large">${data.storeName || 'Global Market'}</div><div class="small">Fresh groceries delivered to your doorstep</div><div class="small mt-2">Transaction: ${data.transactionNumber}</div><div class="small">${formatDateTime(data.date)}</div><div class="small bold mt-2 mb-2">Customer: ${data.customerName || 'Walk-in Customer'}</div>${data.customerPhone ? `<div class="small mb-1">Phone: ${data.customerPhone}</div>` : ''}</div><div class="border-t border-b mb-2">${data.items.map(item => {
      const effectivePrice = item.customPrice ?? item.price;
      const itemDiscount = (item.itemDiscount || 0) * item.quantity;
      return `<div class="item"><div class="item-name">${item.displayName ?? item.name}</div><div class="item-details"><span>${item.quantity} x ${formatCurrency(effectivePrice)}</span><span>${formatCurrency(effectivePrice * item.quantity)}</span></div>${itemDiscount > 0 ? `<div class="item-details" style="margin-left:8px"><span>Item Discount:</span><span>-${formatCurrency(itemDiscount)}</span></div>` : ''}</div>`;
    }).join('')}</div><div class="mb-2"><div class="row"><span>Subtotal:</span><span>${formatCurrency(data.subtotal)}</span></div><div class="row"><span>Timbre:</span><span>${formatCurrency(data.tax)}</span></div>${data.discount && data.discount > 0 ? `<div class="row"><span>Discount:</span><span>-${formatCurrency(data.discount)}</span></div>` : ''}<div class="row bold large border-t" style="padding-top:4px"><span>TOTAL:</span><span>${formatCurrency(data.total)}</span></div></div><div class="border-t mb-2"><div>Payment Method: ${data.paymentMethod.toUpperCase()}</div></div>${data.customerBalance !== undefined && data.customerBalance !== null ? `<div class="border-t dashed mb-2"><div class="bold">${data.isUnifiedBalance ? 'Unified Balance:' : 'Current Balance:'} ${formatCurrency(data.customerBalance)}</div>${data.isUnifiedBalance ? '<div class="small mt-1">(Combined customer & supplier account)</div>' : ''}</div>` : ''}<div class="center small"><div>Thank you for shopping with us!</div>${data.supportPhone ? `<div class="mt-2">For support: ${data.supportPhone}</div>` : ''}</div></body></html>`;
  }
}

export const kioskPrintService = KioskPrintService.getInstance();
