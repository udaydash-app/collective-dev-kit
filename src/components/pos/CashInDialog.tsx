import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DollarSign } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface CashInDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (openingCash: number) => Promise<void>;
}

export const CashInDialog = ({ isOpen, onClose, onConfirm }: CashInDialogProps) => {
  const [openingCash, setOpeningCash] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleConfirm = async () => {
    const amount = parseFloat(openingCash);
    if (isNaN(amount) || amount < 0) {
      return;
    }

    setIsProcessing(true);
    try {
      await onConfirm(amount);
      setOpeningCash('');
    } catch (error) {
      // Error already handled in parent component
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Cash In - Open Register</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="p-4 bg-primary/10 rounded-lg text-center">
            <DollarSign className="h-12 w-12 mx-auto mb-2 text-primary" />
            <p className="text-sm text-muted-foreground">
              Enter the opening cash amount to start your shift
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="openingCash">Opening Cash Amount</Label>
            <Input
              id="openingCash"
              type="number"
              placeholder="0.00"
              value={openingCash}
              onChange={(e) => setOpeningCash(e.target.value)}
              step="0.01"
              min="0"
              autoFocus
            />
            {openingCash && !isNaN(parseFloat(openingCash)) && (
              <p className="text-sm text-muted-foreground">
                Opening with: <span className="font-bold text-primary">{formatCurrency(parseFloat(openingCash))}</span>
              </p>
            )}
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
              disabled={isProcessing || !openingCash || isNaN(parseFloat(openingCash)) || parseFloat(openingCash) < 0}
              className="flex-1"
            >
              {isProcessing ? 'Opening...' : 'Open Register'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
