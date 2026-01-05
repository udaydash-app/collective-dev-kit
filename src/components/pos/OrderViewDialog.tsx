import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { DollarSign, CreditCard, Smartphone, Wallet, Package, User, MapPin, Calendar, Receipt, Phone, Mail } from 'lucide-react';

interface OrderItem {
  id?: string;
  name?: string;
  displayName?: string;
  quantity: number;
  price: number;
  customPrice?: number;
  itemDiscount?: number;
  image_url?: string;
  products?: {
    name: string;
    image_url?: string;
    price: number;
  };
  unit_price?: number;
  subtotal?: number;
}

interface PaymentDetail {
  method: string;
  amount: number;
}

interface OrderViewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  order: {
    id: string;
    order_number: string;
    customer_name?: string;
    customer_phone?: string;
    customer_email?: string;
    delivery_address?: string;
    type: 'pos' | 'online';
    status: string;
    payment_method?: string;
    payment_details?: PaymentDetail[];
    created_at: string;
    items: OrderItem[];
    subtotal: number;
    tax: number;
    discount?: number;
    delivery_fee?: number;
    total: number;
    stores?: { name: string };
    addresses?: { address_line1: string; city: string; phone?: string };
    cashier_name?: string;
    metadata?: any;
  } | null;
}

export const OrderViewDialog = ({ isOpen, onClose, order }: OrderViewDialogProps) => {
  if (!order) return null;
  

  // Parse payment details for display
  const getPaymentInfo = () => {
    if (order.payment_details && Array.isArray(order.payment_details) && order.payment_details.length > 0) {
      return order.payment_details.filter(p => p.amount > 0);
    }
    // Fallback to single payment method
    return [{ method: order.payment_method || 'cash', amount: order.total }];
  };

  const paymentInfo = getPaymentInfo();
  const hasMultiplePayments = paymentInfo.length > 1;

  const getPaymentIcon = (method: string) => {
    switch (method) {
      case 'cash':
        return <DollarSign className="h-4 w-4 text-emerald-600" />;
      case 'credit':
        return <CreditCard className="h-4 w-4 text-blue-600" />;
      case 'mobile_money':
        return <Smartphone className="h-4 w-4 text-purple-600" />;
      default:
        return <Wallet className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getPaymentLabel = (method: string) => {
    switch (method) {
      case 'cash':
        return 'Cash';
      case 'credit':
        return 'Credit';
      case 'mobile_money':
        return 'Mobile Money';
      default:
        return method;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-emerald-500/10 text-emerald-600 border-emerald-200';
      case 'pending':
        return 'bg-yellow-500/10 text-yellow-600 border-yellow-200';
      case 'confirmed':
        return 'bg-blue-500/10 text-blue-600 border-blue-200';
      case 'cancelled':
        return 'bg-red-500/10 text-red-600 border-red-200';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  // Calculate item final amount
  const getItemFinal = (item: OrderItem) => {
    if (order.type === 'pos') {
      const price = item.customPrice ?? item.price;
      const discount = item.itemDiscount ?? 0;
      return (price * item.quantity) - discount;
    }
    return item.subtotal ?? (item.unit_price ?? item.price) * item.quantity;
  };

  // Get item details
  const getItemName = (item: OrderItem) => {
    return order.type === 'pos' 
      ? (item.displayName || item.name) 
      : (item.products?.name || item.name);
  };

  const getItemPrice = (item: OrderItem) => {
    return order.type === 'pos'
      ? (item.customPrice ?? item.price)
      : (item.unit_price ?? item.products?.price ?? item.price);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b bg-gradient-to-r from-primary/5 to-primary/10">
          <DialogTitle className="text-xl font-bold flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Receipt className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <span>{order.order_number}</span>
              <Badge className={`ml-3 ${getStatusColor(order.status)}`}>
                {order.status.replace(/_/g, ' ').toUpperCase()}
              </Badge>
            </div>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-180px)]">
          <div className="p-6 space-y-4">
            {/* Order Info */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Customer:</span>
                <span className="font-medium">{order.customer_name || 'Walk-in Customer'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Date:</span>
                <span className="font-medium">{formatDateTime(order.created_at)}</span>
              </div>
              {order.customer_phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Phone:</span>
                  <span className="font-medium">{order.customer_phone}</span>
                </div>
              )}
              {order.customer_email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Email:</span>
                  <span className="font-medium">{order.customer_email}</span>
                </div>
              )}
              {order.stores?.name && (
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Store:</span>
                  <span className="font-medium">{order.stores.name}</span>
                </div>
              )}
              {order.cashier_name && (
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Cashier:</span>
                  <span className="font-medium">{order.cashier_name}</span>
                </div>
              )}
              {(order.addresses || order.delivery_address) && (
                <div className="flex items-center gap-2 col-span-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Address:</span>
                  <span className="font-medium">
                    {order.addresses 
                      ? `${order.addresses.address_line1}, ${order.addresses.city}` 
                      : order.delivery_address}
                  </span>
                </div>
              )}
            </div>

            <Separator />

            {/* Items Table - Cart Style */}
            <div>
              <h3 className="font-semibold text-sm mb-2">
                {order.type === 'pos' ? 'Sale Items' : 'Order Items'} ({order.items.length})
              </h3>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow className="text-xs">
                      <TableHead className="text-[10px] py-2 px-2">Product Name</TableHead>
                      <TableHead className="text-center text-[10px] py-2 px-2 w-[60px]">Qty</TableHead>
                      <TableHead className="text-right text-[10px] py-2 px-2 w-[80px]">Price</TableHead>
                      <TableHead className="text-right text-[10px] py-2 px-2 w-[70px]">Disc</TableHead>
                      <TableHead className="text-right text-[10px] py-2 px-2 w-[90px]">Final</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {order.items.map((item, idx) => {
                      const itemName = getItemName(item);
                      const unitPrice = getItemPrice(item);
                      const discount = item.itemDiscount ?? 0;
                      const final = getItemFinal(item);

                      return (
                        <TableRow key={item.id || idx} className="text-xs">
                          <TableCell className="py-2 px-2">
                            <span className="text-[11px] font-medium line-clamp-2">{itemName}</span>
                          </TableCell>
                          <TableCell className="text-center py-2 px-2">
                            <span className="text-[11px]">{item.quantity}</span>
                          </TableCell>
                          <TableCell className="text-right py-2 px-2">
                            <span className="text-[11px]">{formatCurrency(unitPrice)}</span>
                          </TableCell>
                          <TableCell className="text-right py-2 px-2">
                            {discount > 0 ? (
                              <span className="text-[11px] text-orange-600">-{formatCurrency(discount)}</span>
                            ) : (
                              <span className="text-[11px] text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right py-2 px-2">
                            <span className="text-[11px] font-semibold">{formatCurrency(final)}</span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            <Separator />

            {/* Totals */}
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(order.subtotal)}</span>
              </div>
              {order.discount && order.discount > 0 && (
                <div className="flex justify-between text-orange-600">
                  <span>Discount</span>
                  <span>-{formatCurrency(order.discount)}</span>
                </div>
              )}
              {order.tax > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax</span>
                  <span>{formatCurrency(order.tax)}</span>
                </div>
              )}
              {order.delivery_fee && order.delivery_fee > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Delivery Fee</span>
                  <span>{formatCurrency(order.delivery_fee)}</span>
                </div>
              )}
              <Separator className="my-2" />
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span className="text-primary">{formatCurrency(order.total)}</span>
              </div>
            </div>

            <Separator />

            {/* Payment Details */}
            <div>
              <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                {hasMultiplePayments ? (
                  <Wallet className="h-4 w-4 text-amber-600" />
                ) : (
                  getPaymentIcon(paymentInfo[0]?.method || 'cash')
                )}
                Payment {hasMultiplePayments ? 'Methods' : 'Method'}
              </h3>
              <div className="space-y-1.5">
                {paymentInfo.map((payment, idx) => (
                  <div 
                    key={idx}
                    className="flex items-center justify-between p-2.5 bg-muted/30 rounded-lg border text-sm"
                  >
                    <div className="flex items-center gap-2">
                      {getPaymentIcon(payment.method)}
                      <span className="font-medium">{getPaymentLabel(payment.method)}</span>
                    </div>
                    <span className="font-semibold">{formatCurrency(payment.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>

        <div className="p-4 border-t bg-muted/30">
          <Button onClick={onClose} className="w-full">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
