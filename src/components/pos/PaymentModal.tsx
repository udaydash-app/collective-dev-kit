import { useState, useRef, useEffect } from 'react';
import { CreditCard, DollarSign, Smartphone, Printer, Plus, X, FileDown, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency } from '@/lib/utils';
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
  onConfirm: (payments: Payment[], totalPaid: number) => Promise<void>;
  transactionData?: {
    transactionNumber: string;
    items: Array<{
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
  };
}

export const PaymentModal = ({ isOpen, onClose, total, onConfirm, transactionData }: PaymentModalProps) => {
  const [payments, setPayments] = useState<Payment[]>([
    { id: '1', method: 'cash', amount: total }
  ]);
  const [cashReceived, setCashReceived] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);

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

  const handlePrint = useReactToPrint({
    contentRef: receiptRef,
  });

  const handleSavePDF = async () => {
    if (!receiptRef.current) return;
    
    try {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [80, 200], // Thermal receipt size
      });
      
      await pdf.html(receiptRef.current, {
        callback: function(doc) {
          doc.save(`receipt-${transactionData?.transactionNumber || 'unknown'}.pdf`);
          toast.success('Receipt saved as PDF');
        },
        x: 5,
        y: 5,
        width: 70,
        windowWidth: 300,
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate PDF');
    }
  };

  const handleSendWhatsApp = async () => {
    if (!transactionData || !receiptRef.current) return;
    
    try {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [80, 200],
      });
      
      const fileName = `receipt-${transactionData.transactionNumber}.pdf`;
      
      await pdf.html(receiptRef.current, {
        callback: async function(doc) {
          // Try Web Share API first (works on mobile)
          if (navigator.share && navigator.canShare) {
            try {
              const pdfBlob = doc.output('blob');
              const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
              
              if (navigator.canShare({ files: [file] })) {
                await navigator.share({
                  title: `Receipt #${transactionData.transactionNumber}`,
                  text: `Receipt - Total: ${formatCurrency(transactionData.total)}`,
                  files: [file],
                });
                toast.success('Receipt shared successfully!');
                return;
              }
            } catch (shareError) {
              console.log('Web Share not available, falling back to download');
            }
          }
          
          // Fallback: Download and open WhatsApp
          doc.save(fileName);
          
          toast.success('PDF downloaded! Opening WhatsApp...', {
            description: 'Please attach the downloaded PDF file manually',
            duration: 5000,
          });
          
          setTimeout(() => {
            const message = encodeURIComponent(
              `Receipt #${transactionData.transactionNumber}\n` +
              `Total: ${formatCurrency(transactionData.total)}\n` +
              `Payment Method: ${transactionData.paymentMethod}\n\n` +
              `(Please attach the downloaded PDF: ${fileName})`
            );
            
            window.location.href = `whatsapp://send?text=${message}`;
          }, 1000);
        },
        x: 5,
        y: 5,
        width: 70,
        windowWidth: 300,
      });
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to generate PDF');
    }
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
      setShowPrintDialog(true);
    } catch (error) {
      console.error("Payment processing error:", error);
      toast.error("There was an error processing the payment", {
        description: "Payment Failed",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClosePrintDialog = async (shouldPrint: boolean) => {
    if (shouldPrint) {
      handlePrint();
    }
    setShowPrintDialog(false);
    setPayments([{ id: '1', method: 'cash', amount: total }]);
    setCashReceived("");
    setSelectedCustomer("");
    setCustomerSearch("");
    onClose();
  };

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

      <AlertDialog open={showPrintDialog} onOpenChange={() => {}}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Receipt Options</AlertDialogTitle>
            <AlertDialogDescription>
              Sale completed successfully! Choose how to handle the receipt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-2 py-4">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => {
                handlePrint();
                handleClosePrintDialog(false);
              }}
            >
              <Printer className="w-4 h-4 mr-2" />
              Print Receipt
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => {
                handleSavePDF();
                handleClosePrintDialog(false);
              }}
            >
              <FileDown className="w-4 h-4 mr-2" />
              Save as PDF
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => {
                handleSendWhatsApp();
                handleClosePrintDialog(false);
              }}
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              Send via WhatsApp
            </Button>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => handleClosePrintDialog(false)}>
              Close
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Hidden receipt for printing */}
      <div className="hidden">
        <div ref={receiptRef}>
          {transactionData && (
            <Receipt
              transactionNumber={transactionData.transactionNumber}
              items={transactionData.items.map(item => ({
                ...item,
                id: item.name,
                subtotal: item.quantity * item.price,
              }))}
              subtotal={transactionData.subtotal}
              tax={transactionData.tax}
              discount={transactionData.discount}
              total={transactionData.total}
              paymentMethod={transactionData.paymentMethod}
              date={new Date()}
              cashierName={transactionData.cashierName}
              storeName={transactionData.storeName}
              logoUrl={transactionData.logoUrl}
              supportPhone={transactionData.supportPhone}
            />
          )}
        </div>
      </div>
    </Dialog>
  );
};