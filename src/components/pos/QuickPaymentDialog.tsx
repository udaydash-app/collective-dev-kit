import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import { useEffect, useRef } from 'react';

interface QuickPaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (shouldPrint: boolean) => void;
  paymentMethod: string;
}

export const QuickPaymentDialog = ({ isOpen, onClose, onConfirm, paymentMethod }: QuickPaymentDialogProps) => {
  const yesButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen && yesButtonRef.current) {
      // Focus the "Yes" button when dialog opens
      setTimeout(() => yesButtonRef.current?.focus(), 100);
    }
  }, [isOpen]);
  const getPaymentMethodLabel = () => {
    switch (paymentMethod) {
      case 'cash':
        return 'Cash';
      case 'credit':
        return 'Credit';
      case 'mobile_money':
        return 'Mobile Money';
      default:
        return paymentMethod;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Complete {getPaymentMethodLabel()} Payment</DialogTitle>
          <DialogDescription>
            Would you like to print the receipt directly?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => {
              onConfirm(false);
              onClose();
            }}
            className="w-full sm:w-auto"
          >
            No, Don't Print
          </Button>
          <Button
            ref={yesButtonRef}
            variant="default"
            onClick={() => {
              onConfirm(true);
              onClose();
            }}
            className="w-full sm:w-auto"
          >
            <Printer className="w-4 h-4 mr-2" />
            Yes, Print Receipt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
