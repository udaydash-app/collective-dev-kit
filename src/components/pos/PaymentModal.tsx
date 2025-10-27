import { useState } from 'react';
import { CreditCard, DollarSign, Smartphone, Printer, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  total: number;
  onConfirm: (payments: Payment[], totalPaid: number) => Promise<void>;
}

export const PaymentModal = ({ isOpen, onClose, total, onConfirm }: PaymentModalProps) => {
  const [payments, setPayments] = useState<Payment[]>([
    { id: '1', method: 'cash', amount: total }
  ]);
  const [cashReceived, setCashReceived] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const remaining = total - totalPaid;
  const change = parseFloat(cashReceived || '0') - totalPaid;
  const hasCashPayment = payments.some(p => p.method === 'cash');

  const paymentMethods = [
    { value: 'cash', label: 'Cash', icon: DollarSign },
    { value: 'card', label: 'Card', icon: CreditCard },
    { value: 'mobile_money', label: 'Mobile Money', icon: Smartphone },
    { value: 'credit', label: 'Credit', icon: CreditCard },
  ];

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
    setPayments(payments.map(p => 
      p.id === id 
        ? { ...p, [field]: field === 'amount' ? parseFloat(value as string) || 0 : value }
        : p
    ));
  };

  const handleConfirm = async () => {
    if (remaining > 0.01) {
      return;
    }

    if (hasCashPayment && parseFloat(cashReceived || '0') < totalPaid) {
      return;
    }

    setIsProcessing(true);
    try {
      await onConfirm(payments, totalPaid);
      onClose();
      setPayments([{ id: '1', method: 'cash', amount: total }]);
      setCashReceived('');
    } finally {
      setIsProcessing(false);
    }
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
                        value={payment.amount}
                        onChange={(e) => updatePayment(payment.id, 'amount', e.target.value)}
                        step="0.01"
                        min="0"
                        max={total}
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

          {hasCashPayment && (
            <div className="space-y-2">
              <Label htmlFor="cashReceived">Cash Received</Label>
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
                (hasCashPayment && parseFloat(cashReceived || '0') < totalPaid)
              }
              className="flex-1"
            >
              {isProcessing ? 'Processing...' : 'Complete Sale'}
            </Button>
          </div>

          <Button variant="outline" className="w-full" disabled>
            <Printer className="h-4 w-4 mr-2" />
            Print Receipt
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};