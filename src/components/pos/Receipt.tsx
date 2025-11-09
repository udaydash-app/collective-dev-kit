import { forwardRef } from 'react';
import { formatCurrency, formatCurrencyCompact, formatDateTime } from '@/lib/utils';
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
    },
    ref
  ) => {
    return (
      <div ref={ref} className="receipt-container w-[80mm] px-2 py-2 bg-white text-black font-mono text-sm">
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
            }
            img {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              display: block !important;
              max-height: 128px !important;
              width: auto !important;
            }
          }
        `}</style>
        <div className="text-center mb-3">
          {logoUrl && (
            <div className="flex justify-center mb-2">
              <img src={logoUrl} alt="Company Logo" className="h-32 w-auto object-contain" style={{ maxHeight: '128px', width: 'auto' }} />
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
          {customerName && customerName !== 'Walk-in Customer' && customerBalance !== undefined && (
            <div className="mt-3 pt-2 border-t border-dashed border-gray-400">
              <p className="text-sm font-bold">Customer Balance: {formatCurrency(customerBalance)}</p>
            </div>
          )}
        </div>

        <div className="text-center text-xs">
          <p>Thank you for shopping with us!</p>
          {supportPhone && <p className="mt-2">For support: {supportPhone}</p>}
        </div>
      </div>
    );
  }
);

Receipt.displayName = 'Receipt';
