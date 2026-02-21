import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatCurrency, formatDate } from '@/lib/utils';
import { FileText, ShoppingCart, Receipt } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

interface PendingBillsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string;
  customerName: string;
  onAmountSelect?: (amount: number, billId: string, billType: "pos_transaction" | "order") => void;
}

interface POSTransaction {
  id: string;
  transaction_number: string;
  total: number;
  discount?: number;
  created_at: string;
  items: any[];
}

interface Order {
  id: string;
  order_number: string;
  total: number;
  created_at: string;
  order_items: Array<{
    quantity: number;
    unit_price: number;
    subtotal: number;
    products: {
      name: string;
    };
  }>;
}

export default function PendingBillsDialog({
  open,
  onOpenChange,
  contactId,
  customerName,
  onAmountSelect
}: PendingBillsDialogProps) {
  const [expandedBill, setExpandedBill] = useState<string | null>(null);

  // Fetch pending POS transactions (credit sales)
  const { data: posTransactions } = useQuery({
    queryKey: ['pending-pos-transactions', contactId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pos_transactions')
        .select('*')
        .eq('customer_id', contactId)
        .eq('payment_method', 'credit')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as POSTransaction[];
    },
    enabled: open && !!contactId
  });

  // Fetch pending orders
  const { data: orders } = useQuery({
    queryKey: ['pending-orders', contactId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items(
            quantity,
            unit_price,
            subtotal,
            products(name)
          )
        `)
        .eq('user_id', contactId)
        .eq('payment_status', 'pending')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Order[];
    },
    enabled: open && !!contactId
  });

  const totalPOSAmount = posTransactions?.reduce((sum, t) => sum + Number(t.total), 0) || 0;
  const totalOrdersAmount = orders?.reduce((sum, o) => sum + Number(o.total), 0) || 0;
  const totalAmount = totalPOSAmount + totalOrdersAmount;

  const handleBillClick = (amount: number, billId: string, billType: "pos_transaction" | "order") => {
    if (onAmountSelect) {
      onAmountSelect(amount, billId, billType);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Pending Bills - {customerName}
          </DialogTitle>
        </DialogHeader>

        <Card className="border-2 border-primary/20">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">Total Outstanding</p>
              <p className="text-3xl font-bold text-primary">
                {formatCurrency(totalAmount)}
              </p>
            </div>
          </CardContent>
        </Card>

        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-4">
            {/* POS Transactions */}
            {posTransactions && posTransactions.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-semibold flex items-center gap-2 text-sm">
                  <Receipt className="h-4 w-4" />
                  Credit Sales ({posTransactions.length})
                </h3>
                {posTransactions.map((transaction) => (
                  <Collapsible
                    key={transaction.id}
                    open={expandedBill === transaction.id}
                    onOpenChange={(isOpen) => setExpandedBill(isOpen ? transaction.id : null)}
                  >
                    <Card 
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => handleBillClick(Number(transaction.total), transaction.id, "pos_transaction")}
                    >
                      <CollapsibleTrigger className="w-full" onClick={(e) => e.stopPropagation()}>
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Receipt className="h-4 w-4 text-muted-foreground" />
                              <div className="text-left">
                                <p className="font-medium">{transaction.transaction_number}</p>
                                <p className="text-sm text-muted-foreground">
                                  {formatDate(transaction.created_at)}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <p className="text-lg font-bold">
                                {formatCurrency(transaction.total)}
                              </p>
                              <ChevronDown className="h-4 w-4 transition-transform" />
                            </div>
                          </div>
                        </CardHeader>
                      </CollapsibleTrigger>
                      <CollapsibleContent onClick={(e) => e.stopPropagation()}>
                        <CardContent className="pt-0 border-t">
                          <div className="space-y-2 mt-3">
                            <p className="text-sm font-medium">Items:</p>
                            {transaction.items?.map((item: any, idx: number) => (
                              <div key={idx} className="flex justify-between text-sm py-1 border-b last:border-0">
                                <span className="text-muted-foreground">
                                  {item.name || item.productName} x {item.quantity}
                                </span>
                                <span className="font-medium">
                                  {formatCurrency(item.price * item.quantity)}
                                </span>
                              </div>
                            ))}
                            {transaction.discount && Number(transaction.discount) > 0 && (
                              <div className="flex justify-between text-sm py-1 text-green-600">
                                <span>Discount</span>
                                <span>-{formatCurrency(transaction.discount)}</span>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                ))}
              </div>
            )}

            {/* Orders */}
            {orders && orders.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-semibold flex items-center gap-2 text-sm">
                  <ShoppingCart className="h-4 w-4" />
                  Pending Orders ({orders.length})
                </h3>
                {orders.map((order) => (
                  <Collapsible
                    key={order.id}
                    open={expandedBill === order.id}
                    onOpenChange={(isOpen) => setExpandedBill(isOpen ? order.id : null)}
                  >
                    <Card 
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => handleBillClick(Number(order.total), order.id, "order")}
                    >
                      <CollapsibleTrigger className="w-full" onClick={(e) => e.stopPropagation()}>
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                              <div className="text-left">
                                <p className="font-medium">{order.order_number}</p>
                                <p className="text-sm text-muted-foreground">
                                  {formatDate(order.created_at)}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <p className="text-lg font-bold">
                                {formatCurrency(order.total)}
                              </p>
                              <ChevronDown className="h-4 w-4 transition-transform" />
                            </div>
                          </div>
                        </CardHeader>
                      </CollapsibleTrigger>
                      <CollapsibleContent onClick={(e) => e.stopPropagation()}>
                        <CardContent className="pt-0 border-t">
                          <div className="space-y-2 mt-3">
                            <p className="text-sm font-medium">Items:</p>
                            {order.order_items?.map((item, idx) => (
                              <div key={idx} className="flex justify-between text-sm py-1 border-b last:border-0">
                                <span className="text-muted-foreground">
                                  {item.products.name} x {item.quantity}
                                </span>
                                <span className="font-medium">
                                  {formatCurrency(item.subtotal)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                ))}
              </div>
            )}

            {/* No bills found */}
            {(!posTransactions || posTransactions.length === 0) && 
             (!orders || orders.length === 0) && (
              <Card>
                <CardContent className="pt-6 text-center text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No pending bills found for this customer</p>
                </CardContent>
              </Card>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
