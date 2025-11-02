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
      <div ref={ref} className="receipt-container w-[80mm] px-1 py-1 bg-white text-black font-mono text-sm">
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
              padding: 2mm !important;
            }
          }
        `}</style>
        <div className="text-center mb-2">
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

        <div className="border-t border-b border-black py-1 mb-1">
          <div className="grid grid-cols-12 gap-0.5 text-[9px] font-bold mb-1 border-b border-dashed border-gray-400 pb-0.5">
            <div className="col-span-4">Product</div>
            <div className="col-span-2 text-center">Qty</div>
            <div className="col-span-2 text-right">Price</div>
            <div className="col-span-2 text-right">Disc</div>
            <div className="col-span-2 text-right">Final</div>
          </div>
          {items.map((item, index) => {
            const isCartDiscount = item.id === 'cart-discount';
            const itemTotal = item.price * item.quantity;
            const finalAmount = itemTotal - (item.itemDiscount || 0);
            
            return (
              <div key={index} className="grid grid-cols-12 gap-0.5 text-[8px] mb-0.5">
                <div className="col-span-4 truncate">{item.name}</div>
                <div className="col-span-2 text-center">{!isCartDiscount ? item.quantity : '-'}</div>
                <div className="col-span-2 text-right">{!isCartDiscount ? formatCurrency(item.price) : ''}</div>
                <div className="col-span-2 text-right">
                  {!isCartDiscount && item.itemDiscount && item.itemDiscount > 0 ? formatCurrency(item.itemDiscount) : ''}
                </div>
                <div className="col-span-2 text-right font-semibold">{formatCurrency(finalAmount)}</div>
              </div>
            );
          })}
        </div>

        <div className="space-y-1 mb-1">
          {discount > 0 && (
            <div className="flex justify-between text-xs">
              <span>Cart Discount:</span>
              <span>-{formatCurrency(discount)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-base border-t border-black pt-1">
            <span>TOTAL:</span>
            <span>{formatCurrency(total)}</span>
          </div>
        </div>

        <div className="border-t border-black pt-1 mb-2">
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
