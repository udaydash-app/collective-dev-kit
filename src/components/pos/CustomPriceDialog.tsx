import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { formatCurrency } from '@/lib/utils';
import { CartItem } from '@/hooks/usePOSTransaction';

interface CustomPriceDialogProps {
  open: boolean;
  onClose: () => void;
  customerName: string;
  cartItems: CartItem[];
  onSave: (selectedProductIds: string[]) => void;
  onSkip: () => void;
}

export function CustomPriceDialog({
  open,
  onClose,
  customerName,
  cartItems,
  onSave,
  onSkip
}: CustomPriceDialogProps) {
  // Filter items that have custom prices or discounts
  const itemsWithCustomPrices = cartItems.filter(item => {
    // Exclude special items (combos, BOGOs, cart discounts)
    if (
      item.id.startsWith('combo-') ||
      item.id.startsWith('bogo-') ||
      item.id.startsWith('multi-bogo-') ||
      item.id === 'cart-discount' ||
      !item.productId
    ) {
      return false;
    }

    // Check if price was modified or discount applied
    const hasCustomPrice = item.customPrice !== undefined && item.customPrice !== item.price;
    const hasDiscount = item.itemDiscount !== undefined && item.itemDiscount > 0;
    return hasCustomPrice || hasDiscount;
  });

  // Initialize with all items selected
  const [selectedItems, setSelectedItems] = useState<Set<string>>(() => 
    new Set(itemsWithCustomPrices.map(item => item.productId))
  );

  const handleToggleItem = (productId: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
  };

  const handleSave = () => {
    onSave(Array.from(selectedItems));
    onClose();
  };

  const handleSkip = () => {
    onSkip();
    onClose();
  };

  if (itemsWithCustomPrices.length === 0) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Save Custom Prices?</DialogTitle>
          <DialogDescription>
            You have modified prices for some items. Would you like to save these custom prices to {customerName}'s profile for future orders?
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[300px] overflow-y-auto space-y-2 py-2">
          <p className="text-sm font-semibold mb-2">Select items to save:</p>
          {itemsWithCustomPrices.map(item => {
            const originalPrice = item.price;
            const effectivePrice = item.customPrice ?? (item.price - (item.itemDiscount || 0));
            
            return (
              <div key={item.productId} className="flex items-start gap-3 p-2 border rounded-md hover:bg-accent/50">
                <Checkbox
                  checked={selectedItems.has(item.productId)}
                  onCheckedChange={() => handleToggleItem(item.productId)}
                  className="mt-1"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{item.name}</p>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground line-through">
                      {formatCurrency(originalPrice)}
                    </span>
                    <span>→</span>
                    <span className="text-primary font-semibold">
                      {formatCurrency(effectivePrice)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleSkip}>
            No, Don't Save
          </Button>
          <Button 
            onClick={handleSave}
            disabled={selectedItems.size === 0}
          >
            Save {selectedItems.size > 0 ? `(${selectedItems.size})` : ''} Price{selectedItems.size !== 1 ? 's' : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
