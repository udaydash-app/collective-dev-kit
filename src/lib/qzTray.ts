import qz from 'qz-tray';
import { formatDateTime } from './utils';

export interface QZReceiptData {
  storeName: string;
  transactionNumber: string;
  date: Date;
  items: Array<{
    name: string;
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
    console.log('🔗 [QZ] connect() called, current state:', { 
      connected: this.connected, 
      isActive: qz.websocket.isActive() 
    });
    
    if (this.connected && qz.websocket.isActive()) {
      console.log('✅ [QZ] Already connected and active, skipping');
      return;
    }

    try {
      if (!qz.websocket.isActive()) {
        console.log('🔌 [QZ] Websocket not active, starting connection...');
        
        // Start connection (don't await the promise as it may not resolve)
        qz.websocket.connect().catch(err => {
          console.error('❌ [QZ] Connection promise rejected:', err);
        });
        
        // Poll for connection with timeout
        const maxAttempts = 50; // 5 seconds (50 * 100ms)
        let attempts = 0;
        
        while (attempts < maxAttempts) {
          if (qz.websocket.isActive()) {
            console.log('✅ [QZ] Connection detected as active after', attempts * 100, 'ms');
            // Add a small delay to ensure connection is fully initialized
            await new Promise(resolve => setTimeout(resolve, 500));
            console.log('✅ [QZ] Connection initialization delay complete');
            this.connected = true;
            return;
          }
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }
        
        throw new Error('Connection timeout - QZ Tray did not become active');
      } else {
        console.log('✅ [QZ] Websocket already active');
        this.connected = true;
      }
    } catch (error) {
      console.error('❌ [QZ] Failed to connect to QZ Tray:', error);
      this.connected = false;
      throw new Error('Please make sure QZ Tray is running on your computer');
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
    console.log('🖨️ [QZ] getDefaultPrinter() called');
    await this.connect();
    console.log('🔍 [QZ] Connection complete, now getting default printer...');
    try {
      const defaultPrinter = await qz.printers.getDefault();
      console.log('✅ [QZ] Default printer found:', defaultPrinter);
      return defaultPrinter;
    } catch (error) {
      console.error('❌ [QZ] Failed to get default printer:', error);
      throw error;
    }
  }

  async printReceipt(data: QZReceiptData, printerName?: string): Promise<void> {
    console.log('📡 [QZ] Starting print receipt process...');
    
    try {
      console.log('🔌 [QZ] Connecting to QZ Tray...');
      await this.connect();
      console.log('✅ [QZ] Connected successfully');

      console.log('🖨️ [QZ] Getting printer name...');
      const printer = printerName || await this.getDefaultPrinter();
      console.log('🖨️ [QZ] Using printer:', printer);
    
    // Build ESC/POS commands for thermal printer
    const config = qz.configs.create(printer);
    console.log('⚙️ [QZ] Config created for printer:', printer);
    
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
    
    // Left align for items
    commands += ESC + 'a' + '0';
    commands += '\n' + '-'.repeat(42) + '\n';
    
    // Items
    data.items.forEach(item => {
      // Item name
      commands += item.name + '\n';
      
      // Quantity and price
      const qtyPrice = `${item.quantity} x ${this.formatCurrency(item.price)}`;
      const total = this.formatCurrency(item.price * item.quantity);
      const spaces = 42 - qtyPrice.length - total.length;
      commands += qtyPrice + ' '.repeat(Math.max(spaces, 1)) + total + '\n';
    });
    
    commands += '-'.repeat(42) + '\n\n';
    
    // Totals
    commands += this.formatLine('Subtotal:', this.formatCurrency(data.subtotal));
    commands += this.formatLine('Tax (15%):', this.formatCurrency(data.tax));
    
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
    
    if (data.supportPhone) {
      commands += 'For support: ' + data.supportPhone + '\n';
    }
    
    // Feed and cut
    commands += '\n\n\n';
    commands += GS + 'V' + '\x00'; // Cut paper
    
      // Send to printer
      const printData = [commands];
      console.log('📄 [QZ] Sending print data to QZ Tray, data length:', commands.length);
      console.log('📄 [QZ] Print data preview:', commands.substring(0, 100));
      
      await qz.print(config, printData);
      console.log('✅ [QZ] qz.print() completed successfully');
    } catch (error) {
      console.error('❌ [QZ] Print receipt failed at step:', error);
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
