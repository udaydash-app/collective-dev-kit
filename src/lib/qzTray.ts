import qz from 'qz-tray';
import { formatDateTime } from './utils';

export interface QZReceiptData {
  storeName: string;
  transactionNumber: string;
  date: Date;
  items: Array<{
    name: string;
    displayName?: string;
    quantity: number;
    price: number;
  }>;
  subtotal: number;
  tax: number;
  discount?: number;
  total: number;
  paymentMethod: string;
  cashierName?: string;
  customerName?: string;
  customerPhone?: string;
  supportPhone?: string;
}

class QZTrayService {
  private static instance: QZTrayService;
  private connected: boolean = false;
  private certificate: string | null = null;

  private constructor() {
    // For production, add your signing certificate here
    // Get a certificate from https://qz.io/download/
    this.setupSigning();
  }

  private setupSigning() {
    // Set up certificate signing for trusted connection
    // For development, we'll use an unsigned connection
    // In production, you should obtain a code signing certificate from https://qz.io/
    
    qz.security.setCertificatePromise(() => {
      // Return empty certificate for unsigned/development mode
      return Promise.resolve(this.certificate || '');
    });

    qz.security.setSignaturePromise((toSign) => {
      // For unsigned/development mode, return a callback function with resolve/reject
      return function(resolve, reject) {
        try {
          // For unsigned connections, just pass the data through
          resolve(toSign);
        } catch (e) {
          reject(e);
        }
      };
    });
  }

  static getInstance(): QZTrayService {
    if (!QZTrayService.instance) {
      QZTrayService.instance = new QZTrayService();
    }
    return QZTrayService.instance;
  }

  async connect(): Promise<void> {
    if (this.connected && qz.websocket.isActive()) {
      return;
    }

    try {
      if (!qz.websocket.isActive()) {
        // Direct connection with minimal polling
        await qz.websocket.connect();
        
        // Quick validation - max 1 second
        const maxAttempts = 20; // 1 second (20 * 50ms)
        let attempts = 0;
        
        while (attempts < maxAttempts && !qz.websocket.isActive()) {
          await new Promise(resolve => setTimeout(resolve, 50));
          attempts++;
        }
        
        if (!qz.websocket.isActive()) {
          throw new Error('Connection timeout');
        }
        
        this.connected = true;
      } else {
        this.connected = true;
      }
    } catch (error) {
      this.connected = false;
      throw new Error('Please make sure QZ Tray is running');
    }
  }

  async disconnect(): Promise<void> {
    if (qz.websocket.isActive()) {
      await qz.websocket.disconnect();
      this.connected = false;
    }
  }

  async getPrinters(): Promise<string[]> {
    await this.connect();
    return await qz.printers.find();
  }

  async getDefaultPrinter(): Promise<string> {
    await this.connect();
    return await qz.printers.getDefault();
  }

  async printReceipt(data: QZReceiptData, printerName?: string): Promise<void> {
    try {
      await this.connect();
      const printer = printerName || await this.getDefaultPrinter();
      const config = qz.configs.create(printer);
    
      // ESC/POS commands
      const ESC = '\x1B';
      const GS = '\x1D';
    
      // Initialize printer
      let commands = ESC + '@';
    
      // Center align
      commands += ESC + 'a' + '1';
    
      // Store name - Large and bold
      commands += ESC + '!' + '\x30'; // Double height and width
      commands += data.storeName + '\n';
      commands += ESC + '!' + '\x00'; // Reset
    
      // Tagline
      commands += '\nFresh groceries delivered to your doorstep\n';
    
      // Transaction details
      commands += '\nTransaction: ' + data.transactionNumber + '\n';
      commands += formatDateTime(data.date) + '\n';
    
      if (data.cashierName) {
        commands += 'Cashier: ' + data.cashierName + '\n';
      }
    
      if (data.customerName) {
        commands += 'Customer: ' + data.customerName + '\n';
      }

      if (data.customerPhone) {
        commands += 'Phone: ' + data.customerPhone + '\n';
      }
    
      // Left align for items
      commands += ESC + 'a' + '0';
      commands += '\n' + '-'.repeat(42) + '\n';
    
      // Items
      data.items.forEach(item => {
        // Item name (use displayName if available)
        commands += (item.displayName ?? item.name) + '\n';
      
        // Quantity and price
        const qtyPrice = `${item.quantity} x ${this.formatCurrency(item.price)}`;
        const total = this.formatCurrency(item.price * item.quantity);
        const spaces = 42 - qtyPrice.length - total.length;
        commands += qtyPrice + ' '.repeat(Math.max(spaces, 1)) + total + '\n';
      });
    
      commands += '-'.repeat(42) + '\n\n';
    
      // Totals
      commands += this.formatLine('Subtotal:', this.formatCurrency(data.subtotal));
      commands += this.formatLine('Timbre:', this.formatCurrency(data.tax));
    
      if (data.discount && data.discount > 0) {
        commands += this.formatLine('Discount:', '-' + this.formatCurrency(data.discount));
      }
    
      commands += '-'.repeat(42) + '\n';
    
      // Total - bold and emphasized
      commands += ESC + '!' + '\x30'; // Double height and width
      commands += this.formatLine('TOTAL:', this.formatCurrency(data.total));
      commands += ESC + '!' + '\x00'; // Reset
    
      commands += '\n' + '-'.repeat(42) + '\n';
    
      // Payment method
      commands += 'Payment Method: ' + data.paymentMethod.toUpperCase() + '\n\n';
    
      // Center align for footer
      commands += ESC + 'a' + '1';
      commands += 'Thank you for shopping with us!\n';
      commands += ESC + '!' + '\x08'; // Bold
      commands += 'Pay Online by OM & Wave\n';
      commands += '07 79 78 47 83\n';
      commands += 'MOMO - 05 46 94 31 31\n';
      commands += ESC + '!' + '\x00'; // Reset
    
      if (data.supportPhone) {
        commands += 'For support: ' + data.supportPhone + '\n';
      }
    
      // Feed and cut
      commands += '\n\n\n';
      commands += GS + 'V' + '\x00'; // Cut paper
    
      // Send to printer immediately
      await qz.print(config, [commands]);
    } catch (error) {
      throw error;
    }
  }

  private formatCurrency(amount: number): string {
    return amount.toLocaleString('fr-CI', { 
      minimumFractionDigits: 0, 
      maximumFractionDigits: 0 
    }) + ' FCFA';
  }

  private formatLine(label: string, value: string): string {
    const spaces = 42 - label.length - value.length;
    return label + ' '.repeat(Math.max(spaces, 1)) + value + '\n';
  }
}

export const qzTrayService = QZTrayService.getInstance();
