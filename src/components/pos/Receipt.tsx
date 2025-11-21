import { forwardRef } from 'react';
import { formatDateTime } from '@/lib/utils';
import { CartItem } from '@/hooks/usePOSTransaction';

interface ReceiptProps {
  transactionNumber: string;
  items: CartItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paymentMethod: string;
  date: Date;
  cashierName?: string;
  customerName?: string;
  storeName?: string;
  logoUrl?: string;
  supportPhone?: string;
  customerBalance?: number;
  isUnifiedBalance?: boolean;
}

export const Receipt = forwardRef<HTMLDivElement, ReceiptProps>(
  (
    {
      transactionNumber,
      items,
      subtotal,
      tax,
      discount,
      total,
      paymentMethod,
      date,
      cashierName,
      customerName,
      storeName,
      logoUrl,
      supportPhone,
      customerBalance,
      isUnifiedBalance,
    },
    ref
  ) => {
  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('fr-CI', { 
      minimumFractionDigits: 0, 
      maximumFractionDigits: 0 
    }) + ' FCFA';
  };

  return (
    <div ref={ref} className="receipt-container" style={{ width: '80mm', padding: '8px', background: 'white', color: 'black', fontFamily: 'monospace', fontSize: '14px' }}>
      <style>{`
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
        .text-center { text-align: center; }
        .text-xl { font-size: 20px; }
        .text-lg { font-size: 18px; }
        .text-sm { font-size: 14px; }
        .text-xs { font-size: 12px; }
        .font-bold { font-weight: bold; }
        .font-semibold { font-weight: 600; }
        .mb-2 { margin-bottom: 8px; }
        .mb-3 { margin-bottom: 12px; }
        .mt-1 { margin-top: 4px; }
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
      `}</style>
      <div className="text-center mb-3">
        {logoUrl && (
          <div className="flex justify-center mb-2">
            <img src={logoUrl} alt="Company Logo" style={{ maxHeight: '128px', width: 'auto' }} />
          </div>
        )}
        <div className={logoUrl ? "mt-2" : ""}>
          <h1 className="text-xl font-bold">{storeName || 'Global Market'}</h1>
          <p className="text-xs">Fresh groceries delivered to your doorstep</p>
          <p className="text-xs mt-2">Transaction: {transactionNumber}</p>
          <p className="text-xs">{formatDateTime(date)}</p>
          <p className="text-xs font-semibold mt-2 mb-2">Customer: {customerName || 'Walk-in Customer'}</p>
        </div>
      </div>

      <div className="border-t border-b border-black py-2 mb-2">
        {items.map((item, index) => {
          const effectivePrice = item.customPrice ?? item.price;
          const itemDiscount = (item.itemDiscount || 0) * item.quantity;
          return (
            <div key={index} className="mb-2">
              <div className="flex justify-between">
                <span className="flex-1">{item.displayName ?? item.name}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span>{item.quantity} x {formatCurrency(effectivePrice)}</span>
                <span>{formatCurrency(effectivePrice * item.quantity)}</span>
              </div>
              {itemDiscount > 0 && (
                <div className="flex justify-between text-xs ml-2">
                  <span>Item Discount:</span>
                  <span>-{formatCurrency(itemDiscount)}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="space-y-1 mb-2">
        <div className="flex justify-between">
          <span>Subtotal:</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span>Tax (15%):</span>
          <span>{formatCurrency(tax)}</span>
        </div>
        {discount > 0 && (
          <div className="flex justify-between">
            <span>Discount:</span>
            <span>-{formatCurrency(discount)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-lg border-t pt-1">
          <span>TOTAL:</span>
          <span>{formatCurrency(total)}</span>
        </div>
      </div>

      <div className="border-t border-black pt-2 mb-2">
        <p className="text-sm">Payment Method: {paymentMethod.toUpperCase()}</p>
      </div>

      {customerBalance !== undefined && customerBalance !== null && (
        <div className="border-t border-dashed border-black pt-2 mb-2">
          <p className="text-sm font-bold">
            {isUnifiedBalance ? 'Unified Balance:' : 'Current Balance:'} {formatCurrency(customerBalance)}
          </p>
          {isUnifiedBalance && (
            <p className="text-xs mt-1">
              (Combined customer & supplier account)
            </p>
          )}
        </div>
      )}

      <div className="text-center text-xs">
        <p>Thank you for shopping with us!</p>
        {supportPhone && <p className="mt-2">For support: {supportPhone}</p>}
      </div>
      </div>
    );
  }
);

Receipt.displayName = 'Receipt';
