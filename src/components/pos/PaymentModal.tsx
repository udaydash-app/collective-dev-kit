import { useState, useRef, useEffect } from 'react';
import { CreditCard, DollarSign, Smartphone, Printer, Plus, X, FileDown, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Receipt } from './Receipt';
import { useReactToPrint } from 'react-to-print';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface Payment {
  id: string;
  method: string;
  amount: number;
}

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  total: number;
  onConfirm: (payments: Payment[], totalPaid: number) => Promise<any>;
  selectedCustomer?: any;
  transactionData?: {
    transactionNumber: string;
    items: Array<{
      id?: string;
      productId?: string;
      name: string;
      quantity: number;
      price: number;
    }>;
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
    paymentMethod: string;
    cashierName?: string;
    storeName?: string;
    logoUrl?: string;
    supportPhone?: string;
    isUnifiedBalance?: boolean;
  };
}

export const PaymentModal = ({ isOpen, onClose, total, onConfirm, selectedCustomer: propSelectedCustomer, transactionData }: PaymentModalProps) => {
  const [payments, setPayments] = useState<Payment[]>([
    { id: '1', method: 'cash', amount: total }
  ]);
  const [cashReceived, setCashReceived] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);
  const completeSaleButtonRef = useRef<HTMLButtonElement>(null);

  const handlePrintReceipt = useReactToPrint({
    contentRef: receiptRef,
  });

  // Pre-fill customer if passed from POS
  useEffect(() => {
    if (propSelectedCustomer?.id && isOpen) {
      setSelectedCustomer(propSelectedCustomer.id);
      setCustomerSearch(propSelectedCustomer.name || '');
    }
  }, [propSelectedCustomer, isOpen]);

  const { data: customers } = useQuery({
    queryKey: ['customers', customerSearch],
    queryFn: async () => {
      let query = supabase
        .from('contacts')
        .select('*')
        .eq('is_customer', true);
      
      if (customerSearch) {
        query = query.or(`name.ilike.%${customerSearch}%,phone.ilike.%${customerSearch}%,email.ilike.%${customerSearch}%`);
      }
      
      const { data, error } = await query.order('name').limit(10);
      if (error) throw error;
      return data;
    },
    enabled: customerSearch.length > 0,
  });

  // Fetch customer balance from journal entries when customer is selected
  const { data: customerBalance } = useQuery({
    queryKey: ['customer-balance', selectedCustomer],
    queryFn: async () => {
      if (!selectedCustomer) return 0;
      
      const customer = customers?.find(c => c.id === selectedCustomer);
      if (!customer) return 0;

      let totalBalance = 0;

      // Calculate balance from posted journal entries for customer account
      if (customer.customer_ledger_account_id) {
        const { data: customerLines } = await supabase
          .from('journal_entry_lines')
          .select(`
            debit_amount,
            credit_amount,
            journal_entries!inner (
              status
            )
          `)
          .eq('account_id', customer.customer_ledger_account_id)
          .eq('journal_entries.status', 'posted');

        if (customerLines && customerLines.length > 0) {
          // Customer account balance = debit - credit (receivable)
          const custReceivableBalance = customerLines.reduce((sum, line) => {
            return sum + (line.debit_amount - line.credit_amount);
          }, 0);
          totalBalance = custReceivableBalance;
        }
      }

      // If also a supplier, subtract supplier balance from posted journal entries
      if (customer.is_supplier && customer.supplier_ledger_account_id) {
        const { data: supplierLines } = await supabase
          .from('journal_entry_lines')
          .select(`
            debit_amount,
            credit_amount,
            journal_entries!inner (
              status
            )
          `)
          .eq('account_id', customer.supplier_ledger_account_id)
          .eq('journal_entries.status', 'posted');

        if (supplierLines && supplierLines.length > 0) {
          // Supplier account balance = credit - debit (payable)
          const suppPayableBalance = supplierLines.reduce((sum, line) => {
            return sum + (line.credit_amount - line.debit_amount);
          }, 0);
          totalBalance -= suppPayableBalance;
        }
      }

      return totalBalance;
    },
    enabled: !!selectedCustomer,
  });

  const selectedCustomerData = customers?.find(c => c.id === selectedCustomer);

  const handlePrint = useReactToPrint({
    contentRef: receiptRef,
  });

  const handleSavePDF = async () => {
    if (!receiptRef.current) return;
    
    try {
      const canvas = await html2canvas(receiptRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [80, 297],
      });
      
      const imgWidth = 80;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      pdf.save(`receipt-${transactionData?.transactionNumber || 'unknown'}.pdf`);
      toast.success('Receipt saved as PDF');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate PDF');
    }
  };

  const handleSendWhatsApp = () => {
    if (!transactionData) return;
    
    // Format items list
    const itemsList = transactionData.items.map(item => 
      `${item.name}\n  ${item.quantity} x ${formatCurrency(item.price)} = ${formatCurrency(item.quantity * item.price)}`
    ).join('\n\n');
    
    // Build receipt-formatted message
    let message = `*${transactionData.storeName || 'Global Market'}*\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    message += `Receipt #${transactionData.transactionNumber}\n`;
    message += `Date: ${formatDateTime(new Date())}\n`;
    if (transactionData.cashierName) {
      message += `Cashier: ${transactionData.cashierName}\n`;
    }
    if (selectedCustomerData) {
      message += `Customer: ${selectedCustomerData.name}\n`;
    }
    message += `\n━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    message += `*ITEMS*\n\n${itemsList}\n\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    message += `Subtotal: ${formatCurrency(transactionData.subtotal)}\n`;
    if (transactionData.discount > 0) {
      message += `Discount: -${formatCurrency(transactionData.discount)}\n`;
    }
    if (transactionData.tax > 0) {
      message += `Tax: ${formatCurrency(transactionData.tax)}\n`;
    }
    message += `\n*TOTAL: ${formatCurrency(transactionData.total)}*\n\n`;
    message += `Payment: ${transactionData.paymentMethod}\n`;
    if (customerBalance !== undefined && customerBalance !== null) {
      message += `\n━━━━━━━━━━━━━━━━━━━━━━\n`;
      const balanceLabel = selectedCustomerData?.is_supplier && selectedCustomerData?.is_customer 
        ? '*Unified Balance:*' 
        : '*Current Balance:*';
      message += `${balanceLabel} ${formatCurrency(customerBalance)}\n`;
      if (selectedCustomerData?.is_supplier && selectedCustomerData?.is_customer) {
        message += `_(Combined customer & supplier account)_\n`;
      }
    }
    if (transactionData.supportPhone) {
      message += `\n━━━━━━━━━━━━━━━━━━━━━━\n`;
      message += `Support: ${transactionData.supportPhone}\n`;
    }
    message += `\nThank you for your business!`;
    
    window.location.href = `whatsapp://send?text=${encodeURIComponent(message)}`;
    toast.success('Opening WhatsApp...');
  };

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const remaining = total - totalPaid;
  const change = parseFloat(cashReceived || '0') - totalPaid;
  const hasCashPayment = payments.some(p => p.method === 'cash');
  const hasCreditPayment = payments.some(p => p.method === 'credit');

  const paymentMethods = [
    { value: 'cash', label: 'Cash', icon: DollarSign },
    { value: 'card', label: 'Card', icon: CreditCard },
    { value: 'mobile_money', label: 'Mobile Money', icon: Smartphone },
    { value: 'credit', label: 'Credit', icon: CreditCard },
  ];

  // Auto-fill amount for single payment methods
  useEffect(() => {
    if (payments.length === 1) {
      setPayments([{ ...payments[0], amount: total }]);
    }
  }, [total, payments.length]);

  const addPayment = () => {
    const newPayment: Payment = {
      id: Date.now().toString(),
      method: 'cash',
      amount: Math.max(0, remaining),
    };
    setPayments([...payments, newPayment]);
  };

  const removePayment = (id: string) => {
    if (payments.length > 1) {
      setPayments(payments.filter(p => p.id !== id));
    }
  };

  const updatePayment = (id: string, field: 'method' | 'amount', value: string | number) => {
    setPayments(prevPayments => {
      const updatedPayments = prevPayments.map(p => 
        p.id === id 
          ? { ...p, [field]: field === 'amount' ? parseFloat(value as string) || 0 : value }
          : p
      );

      // If amount changed and there are exactly 2 payments, auto-adjust the second payment
      if (field === 'amount' && updatedPayments.length === 2) {
        const firstPaymentIndex = updatedPayments.findIndex(p => p.id === id);
        if (firstPaymentIndex === 0) {
          const firstAmount = updatedPayments[0].amount;
          const remaining = Math.max(0, total - firstAmount);
          updatedPayments[1] = { ...updatedPayments[1], amount: remaining };
        }
      }

      return updatedPayments;
    });
  };

  const handleConfirm = async () => {
    if (totalPaid < total) {
      toast.error(`Please collect ${formatCurrency(remaining)} more`, {
        description: "Insufficient Payment",
      });
      return;
    }

    if (hasCreditPayment && !selectedCustomer) {
      toast.error('Please select a customer for credit payment', {
        description: "Customer Required",
      });
      return;
    }

    setIsProcessing(true);
    try {
      await onConfirm(payments, totalPaid);
      
      // After payment completion, print using react-to-print (same as order management)
      console.log('🖨️ Payment completed, triggering print...');
      setTimeout(() => {
        handlePrintReceipt();
      }, 100);
      
      // Reset and close
      setPayments([{ id: '1', method: 'cash', amount: total }]);
      setCashReceived("");
      setSelectedCustomer("");
      setCustomerSearch("");
      onClose();
    } catch (error) {
      console.error("Payment processing error:", error);
      toast.error("There was an error processing the payment", {
        description: "Payment Failed",
      });
    } finally {
      setIsProcessing(false);
    }
  };


  // Auto-focus Complete Sale button when dialog opens
  useEffect(() => {
    if (isOpen && completeSaleButtonRef.current) {
      // Delay focus slightly to ensure dialog is fully rendered
      const timer = setTimeout(() => {
        completeSaleButtonRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Process Payment</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="p-4 bg-primary/10 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <p className="text-sm text-muted-foreground">Total Amount</p>
              <p className="text-2xl font-bold text-primary">{formatCurrency(total)}</p>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Paid</span>
              <span className={totalPaid >= total ? 'text-green-600 font-semibold' : 'font-semibold'}>
                {formatCurrency(totalPaid)}
              </span>
            </div>
            {remaining > 0.01 && (
              <div className="flex justify-between items-center text-sm mt-1">
                <span className="text-muted-foreground">Remaining</span>
                <span className="text-destructive font-semibold">{formatCurrency(remaining)}</span>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <Label className="text-base">Payment Methods</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addPayment}
                className="h-8"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Payment
              </Button>
            </div>

            {payments.map((payment, index) => (
              <Card key={payment.id} className="p-4">
                <div className="flex gap-3 items-start">
                  <div className="flex-1 space-y-3">
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1">Method</Label>
                      <Select
                        value={payment.method}
                        onValueChange={(value) => updatePayment(payment.id, 'method', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {paymentMethods.map((method) => (
                            <SelectItem key={method.value} value={method.value}>
                              <div className="flex items-center gap-2">
                                <method.icon className="h-4 w-4" />
                                {method.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-xs text-muted-foreground mb-1">Amount</Label>
                      <Input
                        type="number"
                        value={payment.amount || ''}
                        onChange={(e) => updatePayment(payment.id, 'amount', e.target.value)}
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                        max={total}
                        disabled={payments.length === 1}
                      />
                    </div>
                  </div>

                  {payments.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removePayment(payment.id)}
                      className="mt-6"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>

          {hasCreditPayment && (
            <div className="space-y-2">
              <Label htmlFor="customerSearch">Select Customer *</Label>
              <Input
                id="customerSearch"
                placeholder="Search customer by name, phone or email..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
              />
              {customers && customers.length > 0 && (
                <div className="border rounded-lg max-h-[150px] overflow-y-auto">
                  {customers.map((customer) => (
                    <div
                      key={customer.id}
                      className={cn(
                        "p-2 cursor-pointer hover:bg-accent transition-colors",
                        selectedCustomer === customer.id && "bg-accent"
                      )}
                      onClick={() => {
                        setSelectedCustomer(customer.id);
                        setCustomerSearch(customer.name);
                      }}
                    >
                      <p className="font-medium">{customer.name}</p>
                      {customer.phone && <p className="text-sm text-muted-foreground">{customer.phone}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {hasCashPayment && (
            <div className="space-y-2">
              <Label htmlFor="cashReceived">Cash Received (Optional)</Label>
              <Input
                id="cashReceived"
                type="number"
                placeholder="Enter total cash received"
                value={cashReceived}
                onChange={(e) => setCashReceived(e.target.value)}
                step="0.01"
                min={totalPaid}
              />
              {cashReceived && change >= 0 && (
                <div className="p-3 bg-accent rounded-lg">
                  <p className="text-sm text-muted-foreground">Change to Return</p>
                  <p className="text-xl font-bold text-primary">{formatCurrency(change)}</p>
                </div>
              )}
              {cashReceived && change < 0 && (
                <p className="text-sm text-destructive">
                  Insufficient cash received
                </p>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isProcessing}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              ref={completeSaleButtonRef}
              onClick={handleConfirm}
              disabled={
                isProcessing ||
                remaining > 0.01 ||
                (hasCreditPayment && !selectedCustomer)
              }
              className="flex-1"
            >
              {isProcessing ? 'Processing...' : 'Complete Sale'}
            </Button>
          </div>
        </div>
      </DialogContent>

      {/* Hidden receipt for printing */}
      <div className="fixed -left-[9999px] top-0 bg-white">
        <div ref={receiptRef}>
          {transactionData && (
            <Receipt
              transactionNumber={transactionData.transactionNumber}
              items={transactionData.items.map(item => ({
                ...item,
                id: item.name,
                productId: item.id || item.name, // Use stored ID or fallback to name
                subtotal: item.quantity * item.price,
              }))}
              subtotal={transactionData.subtotal}
              tax={transactionData.tax}
              discount={transactionData.discount}
              total={transactionData.total}
              paymentMethod={transactionData.paymentMethod}
              date={new Date()}
              cashierName={transactionData.cashierName}
              customerName={selectedCustomerData?.name || propSelectedCustomer?.name}
              storeName={transactionData.storeName}
              logoUrl={transactionData.logoUrl}
              supportPhone={transactionData.supportPhone}
              customerBalance={customerBalance}
              isUnifiedBalance={selectedCustomerData?.is_supplier && selectedCustomerData?.is_customer}
            />
          )}
        </div>
      </div>

      {/* Hidden Receipt for Printing - same as order management page */}
      {transactionData && (
        <div className="hidden">
          <Receipt
            ref={receiptRef}
            transactionNumber={transactionData.transactionNumber}
            date={new Date()}
            items={transactionData.items.map((item: any) => ({
              name: item.name,
              quantity: item.quantity,
              price: item.customPrice ?? item.price,
              itemDiscount: item.itemDiscount || 0
            }))}
            subtotal={transactionData.subtotal}
            discount={transactionData.discount || 0}
            customerName={selectedCustomerData?.name || propSelectedCustomer?.name}
            tax={transactionData.tax || 0}
            total={transactionData.total}
            paymentMethod={payments.map(p => p.method.toUpperCase()).join(', ')}
            cashierName={transactionData.cashierName}
            storeName={transactionData.storeName || 'Global Market'}
            logoUrl={transactionData.logoUrl}
            supportPhone={transactionData.supportPhone}
            customerBalance={customerBalance}
            isUnifiedBalance={selectedCustomerData?.is_supplier && selectedCustomerData?.is_customer}
          />
        </div>
      )}
    </Dialog>
  );
};