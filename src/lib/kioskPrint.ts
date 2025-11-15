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
    const formatPrice = (price: number) => price.toLocaleString('fr-CI', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }) + ' FCFA';

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Receipt - ${data.transactionNumber}</title>
          <style>
            body {
              margin: 0;
              padding: 20px;
              font-family: monospace;
              font-size: 12px;
            }
            .receipt {
              width: 80mm;
              margin: 0 auto;
              background: white;
              color: black;
            }
            .text-center { text-align: center; }
            .text-xs { font-size: 10px; }
            .text-sm { font-size: 11px; }
            .text-lg { font-size: 14px; }
            .text-xl { font-size: 16px; }
            .font-bold { font-weight: bold; }
            .mb-1 { margin-bottom: 4px; }
            .mb-2 { margin-bottom: 8px; }
            .mb-4 { margin-bottom: 16px; }
            .mt-2 { margin-top: 8px; }
            .py-2 { padding-top: 8px; padding-bottom: 8px; }
            .pt-1 { padding-top: 4px; }
            .pt-2 { padding-top: 8px; }
            .border-t { border-top: 1px solid black; }
            .border-b { border-bottom: 1px solid black; }
            .flex { display: flex; }
            .justify-between { justify-content: space-between; }
            .justify-center { justify-content: center; }
            .items-center { align-items: center; }
            .flex-1 { flex: 1; }
            .space-y-1 > * + * { margin-top: 4px; }
            img { max-width: 100%; height: auto; }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="receipt">
            <div class="text-center mb-4">
              ${data.logoUrl ? `
                <div class="flex justify-center mb-2">
                  <img src="${data.logoUrl}" alt="Company Logo" style="height: 120px; width: auto; object-fit: contain;" id="companyLogo" crossorigin="anonymous" />
                </div>
              ` : ''}
              <h1 class="text-xl font-bold">${data.storeName || 'Global Market'}</h1>
              <p class="text-xs">Fresh groceries delivered to your doorstep</p>
              <p class="text-xs mt-2">Transaction: ${data.transactionNumber}</p>
              <p class="text-xs">${new Date(data.date).toLocaleString()}</p>
              ${data.cashierName ? `<p class="text-xs">Cashier: ${data.cashierName}</p>` : ''}
              ${data.customerName && data.customerName !== 'Walk-in Customer' ? `<p class="text-xs">Customer: ${data.customerName}</p>` : ''}
              ${data.customerBalance !== undefined && data.customerName && data.customerName !== 'Walk-in Customer' ? `<p class="text-xs font-bold mt-2">Customer Balance: ${formatPrice(data.customerBalance)}</p>` : ''}
            </div>

            <div class="border-t border-b py-2 mb-2">
              ${data.items.map(item => {
                const effectivePrice = item.customPrice ?? item.price;
                const itemDiscount = item.itemDiscount ? item.itemDiscount * item.quantity : 0;
                return `
                <div class="mb-2">
                  <div class="flex justify-between">
                    <span class="flex-1">${item.displayName ?? item.name}</span>
                  </div>
                  <div class="flex justify-between text-xs">
                    <span>${item.quantity} x ${formatPrice(effectivePrice)}</span>
                    <span>${formatPrice(effectivePrice * item.quantity)}</span>
                  </div>
                  ${itemDiscount > 0 ? `
                  <div class="flex justify-between text-xs" style="margin-left: 8px;">
                    <span>Item Discount:</span>
                    <span>-${formatPrice(itemDiscount)}</span>
                  </div>
                  ` : ''}
                </div>
              `}).join('')}
            </div>

            <div class="space-y-1 mb-2">
              <div class="flex justify-between">
                <span>Subtotal:</span>
                <span>${formatPrice(data.subtotal)}</span>
              </div>
              <div class="flex justify-between">
                <span>Tax (15%):</span>
                <span>${formatPrice(data.tax)}</span>
              </div>
              ${data.discount && data.discount > 0 ? `
                <div class="flex justify-between">
                  <span>Discount:</span>
                  <span>-${formatPrice(data.discount)}</span>
                </div>
              ` : ''}
              <div class="flex justify-between font-bold text-lg border-t pt-1">
                <span>TOTAL:</span>
                <span>${formatPrice(data.total)}</span>
              </div>
            </div>

            <div class="border-t pt-2 mb-4">
              <p class="text-xs">Payment Method: ${data.paymentMethod.toUpperCase()}</p>
            </div>

            <div class="text-center text-xs">
              <p>Thank you for shopping with us!</p>
              ${data.supportPhone ? `<p class="mt-2">For support: ${data.supportPhone}</p>` : ''}
            </div>
          </div>
          <script>
            window.onload = function() {
              ${data.logoUrl ? `
                // Wait for logo to load before printing
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
                      // Print anyway if logo fails to load
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
