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
    quantity: number;
    price: number;
    itemDiscount?: number;
  }>;
  subtotal: number;
  tax: number;
  discount?: number;
  total: number;
  paymentMethod: string;
  cashierName?: string;
  customerName?: string;
  logoUrl?: string;
  supportPhone?: string;
  customerBalance?: number;
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

  /**
   * Print receipt directly using window.print()
   * Works best with Chrome kiosk mode: chrome --kiosk-printing
   * In Electron, uses native print API
   */
  async printReceipt(data: KioskReceiptData): Promise<void> {
    console.log('🖨️ Starting kiosk print...', data);
    
    try {
      const receiptHTML = this.generateReceiptHTML(data);
      
      // Check if running in Electron
      if (window.electron?.isElectron && window.electron.print) {
        console.log('🖨️ Using Electron native print API...');
        await window.electron.print(receiptHTML);
        console.log('✅ Print job sent via Electron');
        return;
      }
      
      // Fallback to browser window.open() for web/kiosk mode
      console.log('🖨️ Using browser print (kiosk mode)...');
      const printWindow = window.open('', '_blank', 'width=300,height=600');
      
      if (!printWindow) {
        console.error('❌ Failed to open print window (popup blocked?)');
        throw new Error('Failed to open print window. Please check if popups are blocked.');
      }
      
      console.log('✅ Print window opened');
      
      printWindow.document.open();
      printWindow.document.write(receiptHTML);
      printWindow.document.close();
      
      console.log('✅ Receipt HTML written');
      
      // Wait for complete load
      await new Promise(resolve => {
        if (printWindow.document.readyState === 'complete') {
          setTimeout(resolve, 100);
        } else {
          printWindow.onload = () => setTimeout(resolve, 100);
        }
      });
      
      console.log('🖨️ Calling print...');
      
      // In kiosk mode with --kiosk-printing, this prints silently to default printer
      printWindow.print();
      
      console.log('✅ Print called - waiting for print job...');
      
      // Don't close immediately - wait for print to complete
      // In kiosk mode, the print happens in background
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      printWindow.close();
      console.log('✅ Print window closed');
      
    } catch (error) {
      console.error('❌ Kiosk print error:', error);
      throw error;
    }
  }

  private generateReceiptHTML(data: KioskReceiptData): string {
    const formatCurrency = (amount: number) => {
      return amount.toLocaleString('fr-CI', { 
        minimumFractionDigits: 0, 
        maximumFractionDigits: 0 
      }) + ' FCFA';
    };

    const itemsHTML = data.items.map(item => `
      <div style="margin-bottom: 8px;">
        <div style="display: flex; justify-content: space-between;">
          <span style="flex: 1;">${item.name}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 11px;">
          <span>${item.quantity} x ${formatCurrency(item.price)}</span>
          <span>${formatCurrency(item.price * item.quantity)}</span>
        </div>
        ${item.itemDiscount && item.itemDiscount > 0 ? `
          <div style="display: flex; justify-content: space-between; font-size: 11px;">
            <span style="margin-left: 8px;">Item Discount:</span>
            <span>-${formatCurrency(item.itemDiscount)}</span>
          </div>
        ` : ''}
      </div>
    `).join('');

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Receipt - ${data.transactionNumber}</title>
          <style>
            @page {
              size: 80mm auto;
              margin: 0;
            }
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: 'Courier New', monospace;
              font-size: 12px;
              line-height: 1.4;
              color: #000;
              background: #fff;
              width: 80mm;
              padding: 4mm;
            }
            .center {
              text-align: center;
            }
            .bold {
              font-weight: bold;
            }
            .large {
              font-size: 16px;
            }
            .small {
              font-size: 10px;
            }
            .border-top {
              border-top: 1px dashed #000;
              padding-top: 4px;
            }
            .border-bottom {
              border-bottom: 1px dashed #000;
              padding-bottom: 4px;
            }
            .mb-2 {
              margin-bottom: 8px;
            }
            .mt-2 {
              margin-top: 8px;
            }
            img {
              max-height: 40px;
              max-width: 200px;
            }
            @media print {
              body {
                width: 80mm;
                margin: 0;
                padding: 2mm;
              }
            }
          </style>
        </head>
        <body>
          <div class="center mb-2">
            ${data.logoUrl ? `<img src="${data.logoUrl}" alt="Logo" class="mb-2">` : ''}
            <div class="large bold">${data.storeName}</div>
            <div class="small">Fresh groceries delivered to your doorstep</div>
            <div class="small mt-2">Transaction: ${data.transactionNumber}</div>
            <div class="small">${formatDateTime(data.date)}</div>
            ${data.cashierName ? `<div class="small">Cashier: ${data.cashierName}</div>` : ''}
            ${data.customerName ? `<div class="small">Customer: ${data.customerName}</div>` : ''}
          </div>

          <div class="border-top border-bottom mb-2">
            ${itemsHTML}
          </div>

          <div class="mb-2">
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <span>Subtotal:</span>
              <span>${formatCurrency(data.subtotal)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <span>Tax (15%):</span>
              <span>${formatCurrency(data.tax)}</span>
            </div>
            ${data.discount && data.discount > 0 ? `
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <span>Discount:</span>
                <span>-${formatCurrency(data.discount)}</span>
              </div>
            ` : ''}
            <div style="display: flex; justify-content: space-between; border-top: 1px solid #000; padding-top: 4px; font-size: 16px;" class="bold">
              <span>TOTAL:</span>
              <span>${formatCurrency(data.total)}</span>
            </div>
          </div>

          <div class="border-top mb-2">
            <div class="small">Payment Method: ${data.paymentMethod.toUpperCase()}</div>
            ${data.customerName && data.customerName !== 'Walk-in Customer' && data.customerBalance !== undefined ? `
              <div class="mt-3 border-top-dashed">
                <div class="small bold">Customer Balance: ${formatCurrency(data.customerBalance)}</div>
              </div>
            ` : ''}
          </div>

          <div class="center small">
            <div>Thank you for shopping with us!</div>
            ${data.supportPhone ? `<div class="mt-2">For support: ${data.supportPhone}</div>` : ''}
          </div>
        </body>
      </html>
    `;
  }
}

export const kioskPrintService = KioskPrintService.getInstance();
