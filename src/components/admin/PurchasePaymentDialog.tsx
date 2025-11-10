import { useState } from 'react';
import { CreditCard, DollarSign, Smartphone, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency } from '@/lib/utils';
import { Card } from '@/components/ui/card';

interface Payment {
  id: string;
  method: string;
  amount: number;
}

interface PurchasePaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  totalAmount: number;
  onConfirm: (payments: Payment[]) => Promise<void>;
  currentPaymentStatus?: string;
}

export const PurchasePaymentDialog = ({ 
  isOpen, 
  onClose, 
  totalAmount,
  onConfirm,
  currentPaymentStatus = 'pending'
}: PurchasePaymentDialogProps) => {
  const [payments, setPayments] = useState<Payment[]>([
    { id: '1', method: 'cash', amount: totalAmount }
  ]);
  const [isProcessing, setIsProcessing] = useState(false);

  const paymentMethods = [
    { value: 'cash', label: 'Cash', icon: DollarSign },
    { value: 'card', label: 'Card', icon: CreditCard },
    { value: 'mobile_money', label: 'Mobile Money', icon: Smartphone },
    { value: 'bank_transfer', label: 'Bank Transfer', icon: CreditCard },
    { value: 'cheque', label: 'Cheque', icon: CreditCard },
  ];

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const remaining = totalAmount - totalPaid;

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
      const updatedPayments = prevPayments.map(p => {
        if (p.id === id) {
          if (field === 'method') {
            return { ...p, method: value as string };
          } else {
            return { ...p, amount: Number(value) || 0 };
          }
        }
        return p;
      });
      return updatedPayments;
    });
  };

  const handleConfirm = async () => {
    if (totalPaid < totalAmount) {
      alert('Total payment must equal or exceed the purchase amount');
      return;
    }

    setIsProcessing(true);
    try {
      await onConfirm(payments);
      // Reset and close
      setPayments([{ id: '1', method: 'cash', amount: totalAmount }]);
      onClose();
    } catch (error) {
      console.error('Payment error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    if (!isProcessing) {
      setPayments([{ id: '1', method: 'cash', amount: totalAmount }]);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Purchase Payment</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Payment Summary */}
          <Card className="p-4 bg-muted/50">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Purchase Amount:</span>
                <span className="font-semibold">{formatCurrency(totalAmount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Total Paid:</span>
                <span className={`font-semibold ${totalPaid >= totalAmount ? 'text-green-600' : 'text-orange-600'}`}>
                  {formatCurrency(totalPaid)}
                </span>
              </div>
              {remaining > 0 && (
                <div className="flex justify-between text-sm pt-2 border-t">
                  <span className="font-semibold text-orange-600">Remaining:</span>
                  <span className="font-semibold text-orange-600">{formatCurrency(remaining)}</span>
                </div>
              )}
              {totalPaid > totalAmount && (
                <div className="flex justify-between text-sm pt-2 border-t">
                  <span className="font-semibold text-red-600">Overpayment:</span>
                  <span className="font-semibold text-red-600">{formatCurrency(totalPaid - totalAmount)}</span>
                </div>
              )}
            </div>
          </Card>

          {/* Payment Methods */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Payment Methods</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addPayment}
                disabled={remaining <= 0}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Payment
              </Button>
            </div>

            {payments.map((payment, index) => {
              const method = paymentMethods.find(m => m.value === payment.method);
              const Icon = method?.icon || DollarSign;

              return (
                <Card key={payment.id} className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                    </div>
                    
                    <div className="flex-1 grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Payment Method</Label>
                        <Select
                          value={payment.method}
                          onValueChange={(value) => updatePayment(payment.id, 'method', value)}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {paymentMethods.map((method) => (
                              <SelectItem key={method.value} value={method.value}>
                                {method.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label className="text-xs">Amount</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={payment.amount}
                          onChange={(e) => updatePayment(payment.id, 'amount', e.target.value)}
                          className="h-9"
                        />
                      </div>
                    </div>

                    {payments.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removePayment(payment.id)}
                        className="flex-shrink-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isProcessing || totalPaid < totalAmount}
          >
            {isProcessing ? 'Processing...' : 'Confirm Payment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
