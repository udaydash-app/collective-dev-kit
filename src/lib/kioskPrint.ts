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

  /**
   * Print receipt directly using window.print()
   * Works best with Chrome kiosk mode: chrome --kiosk-printing
   * In Electron, uses native print API
   */
  async printReceipt(data: KioskReceiptData): Promise<void> {
    console.log('🖨️ KioskPrintService.printReceipt() called');
    console.log('🖨️ Receipt data:', data);
    console.log('🖨️ window.electron available:', !!window.electron);
    console.log('🖨️ window.electron.isElectron:', window.electron?.isElectron);
    console.log('🖨️ window.electron.print:', !!window.electron?.print);
    
    try {
      const receiptHTML = this.generateReceiptHTML(data);
      console.log('🖨️ Receipt HTML generated, length:', receiptHTML.length);
      
      // Check if running in Electron
      if (window.electron?.isElectron && window.electron.print) {
        console.log('🖨️ Using Electron native print API...');
        try {
          await window.electron.print(receiptHTML);
          console.log('✅ Print job sent via Electron successfully');
          return;
        } catch (electronError) {
          console.error('❌ Electron print failed:', electronError);
          throw new Error('Electron print failed: ' + (electronError as Error).message);
        }
      }
      
      // Fallback to browser window.open() for web/kiosk mode
      console.log('🖨️ Using browser print (kiosk mode)...');
      console.log('🖨️ Attempting to open print window...');
      
      const printWindow = window.open('', '_blank', 'width=300,height=600');
      
      if (!printWindow) {
        console.error('❌ Failed to open print window (popup blocked?)');
        throw new Error('Failed to open print window. Please allow popups to print receipts.');
      }
      
      console.log('✅ Print window opened successfully');
      
      printWindow.document.open();
      printWindow.document.write(receiptHTML);
      printWindow.document.close();
      
      console.log('✅ Receipt HTML written to print window');
      
      // Wait for complete load
      await new Promise(resolve => {
        if (printWindow.document.readyState === 'complete') {
          console.log('🖨️ Print window already loaded');
          setTimeout(resolve, 100);
        } else {
          console.log('🖨️ Waiting for print window to load...');
          printWindow.onload = () => {
            console.log('✅ Print window loaded');
            setTimeout(resolve, 100);
          };
        }
      });
      
      console.log('🖨️ About to call window.print()...');
      
      // In kiosk mode with --kiosk-printing, this prints silently to default printer
      printWindow.print();
      
      console.log('✅ window.print() called successfully');
      console.log('🖨️ Waiting 3 seconds before closing window...');
      
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

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Receipt - ${data.transactionNumber}</title>
          <style>
            @media print {
              @page {
                size: 80mm auto;
                margin: 0;
              }
              body {
                margin: 0;
                padding: 0;
              }
              .receipt-container {
                width: 80mm !important;
                margin: 0 !important;
                padding: 3mm !important;
                background: white !important;
                color: black !important;
                font-family: monospace !important;
                font-size: 14px !important;
              }
              .receipt-container * {
                color: black !important;
                background: transparent !important;
              }
              .receipt-container .border-t {
                border-top: 1px solid black !important;
              }
              .receipt-container .border-b {
                border-bottom: 1px solid black !important;
              }
              .receipt-container .border-black {
                border-color: black !important;
              }
              .receipt-container .border-dashed {
                border-style: dashed !important;
              }
              .receipt-container .border-gray-400 {
                border-color: #9ca3af !important;
              }
              .receipt-container .text-xl {
                font-size: 20px !important;
              }
              .receipt-container .text-lg {
                font-size: 18px !important;
              }
              .receipt-container .text-sm {
                font-size: 14px !important;
              }
              .receipt-container .text-xs {
                font-size: 12px !important;
              }
              .receipt-container .font-bold {
                font-weight: bold !important;
              }
              img {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                display: block !important;
                max-height: 128px !important;
                width: auto !important;
              }
            }
            body {
              margin: 0;
              padding: 0;
              font-family: monospace;
            }
            .receipt-container {
              width: 80mm;
              padding: 8px;
              background: white;
              color: black;
              font-family: monospace;
              font-size: 14px;
            }
            .text-center { text-align: center; }
            .text-xl { font-size: 20px; }
            .text-lg { font-size: 18px; }
            .text-sm { font-size: 14px; }
            .text-xs { font-size: 12px; }
            .font-bold { font-weight: bold; }
            .font-semibold { font-weight: 600; }
            .mb-2 { margin-bottom: 8px; }
            .mb-3 { margin-bottom: 12px; }
            .mt-2 { margin-top: 8px; }
            .py-2 { padding-top: 8px; padding-bottom: 8px; }
            .pt-1 { padding-top: 4px; }
            .pt-2 { padding-top: 8px; }
            .border-t { border-top: 1px solid black; }
            .border-b { border-bottom: 1px solid black; }
            .border-black { border-color: black; }
            .border-dashed { border-style: dashed; }
            .flex { display: flex; }
            .justify-between { justify-content: space-between; }
            .justify-center { justify-content: center; }
            .flex-1 { flex: 1; }
            .ml-2 { margin-left: 8px; }
            .space-y-1 > * + * { margin-top: 4px; }
            img { 
              height: 128px;
              width: auto;
              object-fit: contain;
              max-height: 128px;
            }
          </style>
        </head>
        <body>
          <div class="receipt-container">
            <div class="text-center mb-3">
              ${data.logoUrl ? `
                <div class="flex justify-center mb-2">
                  <img src="${data.logoUrl}" alt="Company Logo" style="max-height: 128px; width: auto" id="companyLogo" />
                </div>
              ` : ''}
              <div class="${data.logoUrl ? 'mt-2' : ''}">
                <h1 class="text-xl font-bold">${data.storeName || 'Global Market'}</h1>
                <p class="text-xs">Fresh groceries delivered to your doorstep</p>
                <p class="text-xs mt-2">Transaction: ${data.transactionNumber}</p>
                <p class="text-xs">${formatDateTime(data.date)}</p>
                <p class="text-xs font-semibold mt-2 mb-2">Customer: ${data.customerName || 'Walk-in Customer'}</p>
              </div>
            </div>

            <div class="border-t border-b border-black py-2 mb-2">
              ${data.items.map(item => {
                const effectivePrice = item.customPrice ?? item.price;
                const itemDiscount = (item.itemDiscount || 0) * item.quantity;
                return `
                  <div class="mb-2">
                    <div class="flex justify-between">
                      <span class="flex-1">${item.displayName ?? item.name}</span>
                    </div>
                    <div class="flex justify-between text-xs">
                      <span>${item.quantity} x ${formatCurrency(effectivePrice)}</span>
                      <span>${formatCurrency(effectivePrice * item.quantity)}</span>
                    </div>
                    ${itemDiscount > 0 ? `
                      <div class="flex justify-between text-xs ml-2">
                        <span>Item Discount:</span>
                        <span>-${formatCurrency(itemDiscount)}</span>
                      </div>
                    ` : ''}
                  </div>
                `;
              }).join('')}
            </div>

            <div class="space-y-1 mb-2">
              <div class="flex justify-between">
                <span>Subtotal:</span>
                <span>${formatCurrency(data.subtotal)}</span>
              </div>
              <div class="flex justify-between">
                <span>Tax (15%):</span>
                <span>${formatCurrency(data.tax)}</span>
              </div>
              ${data.discount && data.discount > 0 ? `
                <div class="flex justify-between">
                  <span>Discount:</span>
                  <span>-${formatCurrency(data.discount)}</span>
                </div>
              ` : ''}
              <div class="flex justify-between font-bold text-lg border-t pt-1">
                <span>TOTAL:</span>
                <span>${formatCurrency(data.total)}</span>
              </div>
            </div>

            <div class="border-t border-black pt-2 mb-2">
              <p class="text-sm">Payment Method: ${data.paymentMethod.toUpperCase()}</p>
            </div>

            ${data.customerBalance !== undefined && data.customerBalance !== null ? `
              <div class="border-t border-dashed border-black pt-2 mb-2">
                <p class="text-sm font-bold">
                  ${data.isUnifiedBalance ? 'Unified Balance:' : 'Current Balance:'} ${formatCurrency(data.customerBalance)}
                </p>
                ${data.isUnifiedBalance ? `
                  <p class="text-xs mt-1">
                    (Combined customer & supplier account)
                  </p>
                ` : ''}
              </div>
            ` : ''}

            <div class="text-center text-xs">
              <p>Thank you for shopping with us!</p>
              ${data.supportPhone ? `<p class="mt-2">For support: ${data.supportPhone}</p>` : ''}
            </div>
          </div>
          <script>
            window.onload = function() {
              ${data.logoUrl ? `
                var logo = document.getElementById('companyLogo');
                if (logo) {
                  if (logo.complete) {
                    window.print();
                    setTimeout(() => window.close(), 100);
                  } else {
                    logo.onload = function() {
                      window.print();
                      setTimeout(() => window.close(), 100);
                    };
                    logo.onerror = function() {
                      window.print();
                      setTimeout(() => window.close(), 100);
                    };
                  }
                } else {
                  window.print();
                  setTimeout(() => window.close(), 100);
                }
              ` : `
                window.print();
                setTimeout(() => window.close(), 100);
              `}
            };
          </script>
        </body>
      </html>
    `;
  }
}

export const kioskPrintService = KioskPrintService.getInstance();
