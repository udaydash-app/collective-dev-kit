import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DollarSign, CreditCard, Smartphone, Wallet, User, Clock, Receipt, Printer, X } from 'lucide-react';
import { formatCurrency, formatDateTime, cn } from '@/lib/utils';
import { useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Receipt as ReceiptComponent } from './Receipt';

interface TransactionItem {
  productId: string;
  variantId?: string;
  name: string;
  quantity: number;
  price: number;
  discount?: number;
  displayName?: string;
  unit?: string;
}

interface TransactionViewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: {
    id: string;
    transaction_number?: string;
    total: number;
    subtotal?: number;
    tax?: number;
    discount?: number;
    payment_method: string;
    payment_details?: Array<{ method: string; amount: number }>;
    created_at: string;
    customer_name?: string;
    items?: TransactionItem[] | any; // Can be JSON from database
    notes?: string;
  } | null;
  storeName?: string;
}

// Helper to normalize items from database JSON format
const normalizeItems = (items: any): TransactionItem[] => {
  if (!items) return [];
  
  // If it's already an array, process it
  const itemArray = Array.isArray(items) ? items : [];
  
  return itemArray.map((item: any) => ({
    productId: item.productId || item.product_id || '',
    variantId: item.variantId || item.variant_id,
    name: item.name || item.displayName || 'Unknown Item',
    quantity: item.quantity || 1,
    price: item.price || 0,
    discount: item.discount || 0,
    displayName: item.displayName || item.display_name || item.name,
    unit: item.unit || 'unit',
  }));
};

export const TransactionViewDialog = ({ 
  isOpen, 
  onClose, 
  transaction,
  storeName 
}: TransactionViewDialogProps) => {
  const receiptRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: receiptRef,
    documentTitle: `Receipt-${transaction?.transaction_number || 'Unknown'}`,
  });

  if (!transaction) return null;

  const items = normalizeItems(transaction.items);
  const hasMultiplePayments = transaction.payment_details && 
    Array.isArray(transaction.payment_details) && 
    transaction.payment_details.filter(p => p.amount > 0).length > 1;

  const getPaymentMethodDisplay = () => {
    if (transaction.payment_details && Array.isArray(transaction.payment_details) && transaction.payment_details.length > 0) {
      return transaction.payment_details
        .filter(p => p.amount > 0)
        .map(p => ({
          method: p.method,
          amount: p.amount,
          label: p.method === 'mobile_money' ? 'Mobile Money' : 
                 p.method === 'credit' ? 'Credit' : 'Cash'
        }));
    }
    return [{
      method: transaction.payment_method,
      amount: transaction.total,
      label: transaction.payment_method === 'mobile_money' ? 'Mobile Money' : 
             transaction.payment_method === 'credit' ? 'Credit' : 'Cash'
    }];
  };

  const paymentMethods = getPaymentMethodDisplay();

  const getPaymentIcon = (method: string) => {
    switch (method) {
      case 'cash': return <DollarSign className="h-4 w-4 text-emerald-600" />;
      case 'credit': return <CreditCard className="h-4 w-4 text-blue-600" />;
      case 'mobile_money': return <Smartphone className="h-4 w-4 text-purple-600" />;
      default: return <Wallet className="h-4 w-4 text-amber-600" />;
    }
  };

  // Convert items to CartItem format for Receipt
  const cartItems = items.map(item => ({
    id: item.productId,
    productId: item.productId,
    variantId: item.variantId,
    name: item.displayName || item.name,
    price: item.price,
    quantity: item.quantity,
    discount: item.discount || 0,
    unit: item.unit || 'unit',
    displayName: item.displayName,
  }));

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col bg-background">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Transaction Details
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-4">
            {/* Header Info */}
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground">Transaction #</p>
                <p className="font-bold text-lg">{transaction.transaction_number || 'N/A'}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Date</p>
                <p className="font-medium flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDateTime(transaction.created_at)}
                </p>
              </div>
            </div>

            {/* Customer Info */}
            {transaction.customer_name && (
              <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <User className="h-4 w-4 text-blue-600" />
                <span className="font-medium">{transaction.customer_name}</span>
              </div>
            )}

            {/* Items Table */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted/50 px-4 py-2 border-b">
                <h3 className="font-semibold text-sm">Items ({items.length})</h3>
              </div>
              <div className="divide-y">
                {items.length > 0 ? (
                  items.map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-3 hover:bg-muted/30">
                      <div className="flex-1">
                        <p className="font-medium">{item.displayName || item.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.quantity} × {formatCurrency(item.price)}
                          {item.discount && item.discount > 0 && (
                            <span className="text-red-500 ml-2">(-{formatCurrency(item.discount)})</span>
                          )}
                        </p>
                      </div>
                      <p className="font-semibold">
                        {formatCurrency((item.price * item.quantity) - (item.discount || 0))}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-center text-muted-foreground">
                    No item details available
                  </div>
                )}
              </div>
            </div>

            {/* Totals */}
            <div className="space-y-2 p-4 bg-muted/30 rounded-lg">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(transaction.subtotal || transaction.total)}</span>
              </div>
              {(transaction.discount || 0) > 0 && (
                <div className="flex justify-between text-sm text-red-600">
                  <span>Discount</span>
                  <span>-{formatCurrency(transaction.discount || 0)}</span>
                </div>
              )}
              {(transaction.tax || 0) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax</span>
                  <span>{formatCurrency(transaction.tax || 0)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-bold text-lg">
                <span>Total</span>
                <span className="text-primary">{formatCurrency(transaction.total)}</span>
              </div>
            </div>

            {/* Payment Details */}
            <div className="space-y-2">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                {hasMultiplePayments ? (
                  <Wallet className="h-4 w-4 text-amber-600" />
                ) : (
                  getPaymentIcon(paymentMethods[0]?.method)
                )}
                Payment Method{hasMultiplePayments ? 's' : ''}
              </h3>
              <div className="grid gap-2">
                {paymentMethods.map((pm, index) => (
                  <div 
                    key={index} 
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg border",
                      pm.method === 'cash' && "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800",
                      pm.method === 'credit' && "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800",
                      pm.method === 'mobile_money' && "bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {getPaymentIcon(pm.method)}
                      <span className="font-medium">{pm.label}</span>
                    </div>
                    <span className="font-bold">{formatCurrency(pm.amount)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            {transaction.notes && (
              <div className="p-3 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Notes</p>
                <p className="text-sm mt-1">{transaction.notes}</p>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t flex-shrink-0">
          <Button variant="outline" onClick={onClose}>
            <X className="h-4 w-4 mr-2" />
            Close
          </Button>
          <Button onClick={() => handlePrint()}>
            <Printer className="h-4 w-4 mr-2" />
            Print Receipt
          </Button>
        </div>

        {/* Hidden Receipt for Printing */}
        <div className="hidden">
          <ReceiptComponent
            ref={receiptRef}
            transactionNumber={transaction.transaction_number || 'N/A'}
            items={cartItems}
            subtotal={transaction.subtotal || transaction.total}
            tax={transaction.tax || 0}
            discount={transaction.discount || 0}
            total={transaction.total}
            paymentMethod={hasMultiplePayments ? 'Multiple' : paymentMethods[0]?.label || 'Cash'}
            date={new Date(transaction.created_at)}
            customerName={transaction.customer_name}
            storeName={storeName}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
