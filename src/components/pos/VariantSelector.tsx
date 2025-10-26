import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatCurrency } from '@/lib/utils';
import { Package } from 'lucide-react';

interface Variant {
  id: string;
  label: string | null;
  quantity: number;
  unit: string;
  price: number;
  is_available: boolean;
  is_default: boolean;
}

interface VariantSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  product: any;
  onSelectVariant: (variant: Variant) => void;
}

export const VariantSelector = ({ 
  isOpen, 
  onClose, 
  product, 
  onSelectVariant 
}: VariantSelectorProps) => {
  const variants = product?.product_variants?.filter((v: Variant) => v.is_available) || [];

  const handleSelect = (variant: Variant) => {
    onSelectVariant(variant);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Select Variant</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Product Info */}
          <div className="flex items-center gap-3 pb-4 border-b">
            {product?.image_url ? (
              <img
                src={product.image_url}
                alt={product.name}
                className="w-16 h-16 object-cover rounded"
              />
            ) : (
              <div className="w-16 h-16 bg-muted rounded flex items-center justify-center">
                <Package className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
            <div>
              <p className="font-semibold">{product?.name}</p>
              <p className="text-sm text-muted-foreground">
                Choose from {variants.length} available variants
              </p>
            </div>
          </div>

          {/* Variants Grid */}
          <div className="grid gap-2 max-h-[400px] overflow-y-auto">
            {variants.map((variant: Variant) => (
              <Button
                key={variant.id}
                variant="outline"
                className="h-auto p-4 justify-between hover:bg-primary hover:text-primary-foreground"
                onClick={() => handleSelect(variant)}
              >
                <div className="text-left">
                  <p className="font-medium">
                    {variant.label || `${variant.quantity}${variant.unit}`}
                  </p>
                  {variant.is_default && (
                    <span className="text-xs text-muted-foreground">Default</span>
                  )}
                </div>
                <p className="text-lg font-bold">
                  {formatCurrency(Number(variant.price))}
                </p>
              </Button>
            ))}
          </div>

          <Button variant="outline" onClick={onClose} className="w-full">
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
