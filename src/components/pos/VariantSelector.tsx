import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
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
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="text-xl">Select Variant</DialogTitle>
          <DialogDescription>Choose the product variant you want to add to the cart</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Product Info */}
          <div className="flex items-center gap-4 pb-5 border-b">
            {product?.image_url ? (
              <img
                src={product.image_url}
                alt={product.name}
                className="w-20 h-20 object-cover rounded"
              />
            ) : (
              <div className="w-20 h-20 bg-muted rounded flex items-center justify-center">
                <Package className="h-10 w-10 text-muted-foreground" />
              </div>
            )}
            <div>
              <p className="font-semibold text-lg">{product?.name}</p>
              <p className="text-base text-muted-foreground">
                Choose from {variants.length} available variants
              </p>
            </div>
          </div>

          {/* Variants Grid */}
          <div className="grid gap-3 max-h-[400px] overflow-y-auto">
            {variants.map((variant: Variant) => (
              <Button
                key={variant.id}
                variant="outline"
                size="lg"
                className="h-auto min-h-[4rem] p-5 justify-between hover:bg-primary hover:text-primary-foreground"
                onClick={() => handleSelect(variant)}
              >
                <div className="text-left">
                  <p className="font-medium text-base">
                    {variant.label || `${variant.quantity}${variant.unit}`}
                  </p>
                  {variant.is_default && (
                    <span className="text-sm text-muted-foreground">Default</span>
                  )}
                </div>
                <p className="text-xl font-bold">
                  {formatCurrency(Number(variant.price))}
                </p>
              </Button>
            ))}
          </div>

          <Button variant="outline" size="lg" onClick={onClose} className="w-full h-14 text-base">
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
