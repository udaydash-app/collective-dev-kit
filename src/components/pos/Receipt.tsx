import { forwardRef } from 'react';
import { formatCurrency } from '@/lib/utils';
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
  storeName?: string;
  logoUrl?: string;
  supportPhone?: string;
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
      storeName,
      logoUrl,
      supportPhone,
    },
    ref
  ) => {
    return (
      <div ref={ref} className="w-[80mm] p-4 bg-white text-black font-mono text-sm">
        <div className="text-center mb-4">
          {logoUrl && (
            <div className="flex justify-center mb-2">
              <img src={logoUrl} alt="Company Logo" className="h-12 w-auto object-contain" />
            </div>
          )}
          <h1 className="text-xl font-bold">{storeName || 'Global Market'}</h1>
          <p className="text-xs">Fresh groceries delivered to your doorstep</p>
          <p className="text-xs mt-2">Transaction: {transactionNumber}</p>
          <p className="text-xs">{date.toLocaleString()}</p>
          {cashierName && <p className="text-xs">Cashier: {cashierName}</p>}
        </div>

        <div className="border-t border-b border-black py-2 mb-2">
          {items.map((item, index) => (
            <div key={index} className="mb-2">
              <div className="flex justify-between">
                <span className="flex-1">{item.name}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span>
                  {item.quantity} x {formatCurrency(item.price)}
                </span>
                <span>{formatCurrency(item.price * item.quantity)}</span>
              </div>
            </div>
          ))}
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
          <div className="flex justify-between font-bold text-lg border-t border-black pt-1">
            <span>TOTAL:</span>
            <span>{formatCurrency(total)}</span>
          </div>
        </div>

        <div className="border-t border-black pt-2 mb-4">
          <p className="text-xs">Payment Method: {paymentMethod.toUpperCase()}</p>
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
