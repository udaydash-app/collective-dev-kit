import { forwardRef, useEffect, useState } from 'react';
import { formatCurrency } from '@/lib/utils';
import { CartItem } from '@/hooks/usePOSTransaction';
import { removeBackground, loadImageFromUrl } from '@/lib/removeBackground';

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
    const [processedLogoUrl, setProcessedLogoUrl] = useState<string | null>(null);
    const [isProcessingLogo, setIsProcessingLogo] = useState(false);

    useEffect(() => {
      if (logoUrl && !isProcessingLogo && !processedLogoUrl) {
        setIsProcessingLogo(true);
        loadImageFromUrl(logoUrl)
          .then((img) => removeBackground(img))
          .then((blob) => {
            const url = URL.createObjectURL(blob);
            setProcessedLogoUrl(url);
          })
          .catch((error) => {
            console.error('Failed to remove background:', error);
            // Fallback to original logo
            setProcessedLogoUrl(logoUrl);
          })
          .finally(() => {
            setIsProcessingLogo(false);
          });
      }

      return () => {
        if (processedLogoUrl && processedLogoUrl !== logoUrl) {
          URL.revokeObjectURL(processedLogoUrl);
        }
      };
    }, [logoUrl, isProcessingLogo, processedLogoUrl]);

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
          }
        `}</style>
        <div className="text-center mb-2">
          {processedLogoUrl && (
            <div className="flex justify-center mb-2">
              <img src={processedLogoUrl} alt="Company Logo" className="h-20 w-auto object-contain" />
            </div>
          )}
          <h1 className="text-xl font-bold">{storeName || 'Global Market'}</h1>
          <p className="text-xs">Fresh groceries delivered to your doorstep</p>
          <p className="text-xs mt-2">Transaction: {transactionNumber}</p>
          <p className="text-xs">{date.toLocaleString()}</p>
          {cashierName && <p className="text-xs">Cashier: {cashierName}</p>}
        </div>

        <div className="border-t border-b border-black py-2 mb-2">
          <div className="grid grid-cols-12 gap-1 text-[11px] font-bold mb-1 border-b border-dashed border-gray-400 pb-1">
            <div className="col-span-5">Product</div>
            <div className="col-span-2 text-center">Qty</div>
            <div className="col-span-2 text-right">Price</div>
            <div className="col-span-1 text-right">Disc</div>
            <div className="col-span-2 text-right">Final</div>
          </div>
          {items.map((item, index) => {
            const isCartDiscount = item.id === 'cart-discount';
            const itemTotal = item.price * item.quantity;
            const finalAmount = itemTotal - (item.itemDiscount || 0);
            
            return (
              <div key={index} className="grid grid-cols-12 gap-1 text-[10px] mb-1">
                <div className="col-span-5 break-words leading-tight">{item.name}</div>
                <div className="col-span-2 text-center">{!isCartDiscount ? item.quantity : '-'}</div>
                <div className="col-span-2 text-right">{!isCartDiscount ? formatCurrency(item.price) : ''}</div>
                <div className="col-span-1 text-right">
                  {!isCartDiscount && item.itemDiscount && item.itemDiscount > 0 ? formatCurrency(item.itemDiscount) : ''}
                </div>
                <div className="col-span-2 text-right font-semibold">{formatCurrency(finalAmount)}</div>
              </div>
            );
          })}
        </div>

        <div className="space-y-2 mb-4 border-t-2 border-black pt-3 mt-4">
          {discount > 0 && (
            <div className="flex justify-between text-base mb-3">
              <span>Cart Discount:</span>
              <span className="font-semibold">-{formatCurrency(discount)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-2xl border-t-2 border-black pt-3 mt-3">
            <span>TOTAL:</span>
            <span>{formatCurrency(total)}</span>
          </div>
        </div>

        <div className="border-t border-black pt-2 mb-2">
          <p className="text-sm">Payment Method: {paymentMethod.toUpperCase()}</p>
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
