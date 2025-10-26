import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DollarSign, AlertCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface CashOutDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (closingCash: number, notes?: string) => Promise<void>;
  openingCash: number;
  expectedCash: number;
}

export const CashOutDialog = ({ isOpen, onClose, onConfirm, openingCash, expectedCash }: CashOutDialogProps) => {
  const [closingCash, setClosingCash] = useState('');
  const [notes, setNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const actualClosing = parseFloat(closingCash);
  const difference = !isNaN(actualClosing) ? actualClosing - expectedCash : 0;
  const hasDifference = !isNaN(actualClosing) && Math.abs(difference) > 0.01;

  const handleConfirm = async () => {
    const amount = parseFloat(closingCash);
    if (isNaN(amount) || amount < 0) {
      return;
    }

    setIsProcessing(true);
    try {
      await onConfirm(amount, notes || undefined);
      setClosingCash('');
      setNotes('');
      onClose();
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Cash Out - Close Register</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-accent rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Opening Cash</p>
              <p className="text-lg font-bold">{formatCurrency(openingCash)}</p>
            </div>
            <div className="p-3 bg-primary/10 rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Expected Cash</p>
              <p className="text-lg font-bold text-primary">{formatCurrency(expectedCash)}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="closingCash">Actual Closing Cash Count</Label>
            <Input
              id="closingCash"
              type="number"
              placeholder="0.00"
              value={closingCash}
              onChange={(e) => setClosingCash(e.target.value)}
              step="0.01"
              min="0"
              autoFocus
            />
          </div>

          {hasDifference && (
            <div className={`p-4 rounded-lg ${difference > 0 ? 'bg-green-500/10' : 'bg-destructive/10'}`}>
              <div className="flex items-start gap-2">
                <AlertCircle className={`h-5 w-5 mt-0.5 ${difference > 0 ? 'text-green-600' : 'text-destructive'}`} />
                <div className="flex-1">
                  <p className="font-semibold">
                    {difference > 0 ? 'Cash Over' : 'Cash Short'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Difference: <span className={`font-bold ${difference > 0 ? 'text-green-600' : 'text-destructive'}`}>
                      {difference > 0 ? '+' : ''}{formatCurrency(Math.abs(difference))}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any notes about cash discrepancies or issues..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

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
              disabled={isProcessing || !closingCash || isNaN(parseFloat(closingCash)) || parseFloat(closingCash) < 0}
              className="flex-1"
            >
              {isProcessing ? 'Closing...' : 'Close Register'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
