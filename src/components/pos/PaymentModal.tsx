import { useState } from 'react';
import { CreditCard, DollarSign, Smartphone, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { formatCurrency } from '@/lib/utils';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  total: number;
  onConfirm: (paymentMethod: string) => Promise<void>;
}

export const PaymentModal = ({ isOpen, onClose, total, onConfirm }: PaymentModalProps) => {
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [cashReceived, setCashReceived] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const change = parseFloat(cashReceived) - total;

  const handleConfirm = async () => {
    if (paymentMethod === 'cash' && change < 0) {
      return;
    }

    setIsProcessing(true);
    try {
      await onConfirm(paymentMethod);
      onClose();
      setCashReceived('');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Process Payment</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="p-4 bg-primary/10 rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">Total Amount</p>
            <p className="text-3xl font-bold text-primary">{formatCurrency(total)}</p>
          </div>

          <div className="space-y-4">
            <Label>Payment Method</Label>
            <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod}>
              <div className="flex items-center space-x-2 p-3 border rounded-lg cursor-pointer hover:bg-accent">
                <RadioGroupItem value="cash" id="cash" />
                <Label htmlFor="cash" className="flex items-center gap-2 cursor-pointer flex-1">
                  <DollarSign className="h-4 w-4" />
                  Cash
                </Label>
              </div>
              <div className="flex items-center space-x-2 p-3 border rounded-lg cursor-pointer hover:bg-accent">
                <RadioGroupItem value="card" id="card" />
                <Label htmlFor="card" className="flex items-center gap-2 cursor-pointer flex-1">
                  <CreditCard className="h-4 w-4" />
                  Card
                </Label>
              </div>
              <div className="flex items-center space-x-2 p-3 border rounded-lg cursor-pointer hover:bg-accent">
                <RadioGroupItem value="mobile" id="mobile" />
                <Label htmlFor="mobile" className="flex items-center gap-2 cursor-pointer flex-1">
                  <Smartphone className="h-4 w-4" />
                  Mobile Money
                </Label>
              </div>
              <div className="flex items-center space-x-2 p-3 border rounded-lg cursor-pointer hover:bg-accent">
                <RadioGroupItem value="credit" id="credit" />
                <Label htmlFor="credit" className="flex items-center gap-2 cursor-pointer flex-1">
                  <CreditCard className="h-4 w-4" />
                  Credit
                </Label>
              </div>
            </RadioGroup>
          </div>

          {paymentMethod === 'cash' && (
            <div className="space-y-2">
              <Label htmlFor="cashReceived">Cash Received</Label>
              <Input
                id="cashReceived"
                type="number"
                placeholder="Enter amount received"
                value={cashReceived}
                onChange={(e) => setCashReceived(e.target.value)}
                step="0.01"
                min={total}
              />
              {cashReceived && change >= 0 && (
                <div className="p-3 bg-accent rounded-lg">
                  <p className="text-sm text-muted-foreground">Change to Return</p>
                  <p className="text-xl font-bold text-primary">{formatCurrency(change)}</p>
                </div>
              )}
              {cashReceived && change < 0 && (
                <p className="text-sm text-destructive">
                  Insufficient amount received
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
                (paymentMethod === 'cash' && (!cashReceived || change < 0))
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
