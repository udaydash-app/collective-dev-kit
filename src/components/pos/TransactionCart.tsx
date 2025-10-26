import { Minus, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { formatCurrency } from '@/lib/utils';
import { CartItem } from '@/hooks/usePOSTransaction';

interface TransactionCartProps {
  items: CartItem[];
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemove: (productId: string) => void;
  onClear: () => void;
}

export const TransactionCart = ({
  items,
  onUpdateQuantity,
  onRemove,
  onClear,
}: TransactionCartProps) => {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-muted-foreground mb-2">Cart is empty</p>
        <p className="text-sm text-muted-foreground">
          Scan or search for products to add them
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Cart Items ({items.length})</h3>
        <Button variant="ghost" size="sm" onClick={onClear}>
          Clear All
        </Button>
      </div>

      <div className="space-y-2 max-h-[500px] overflow-y-auto">
        {items.map((item) => (
          <Card key={item.id} className="p-3">
            <div className="flex items-center gap-3">
              {item.image_url && (
                <img
                  src={item.image_url}
                  alt={item.name}
                  className="w-12 h-12 object-cover rounded"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{item.name}</p>
                <p className="text-sm text-muted-foreground">
                  {formatCurrency(item.price)} each
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <Input
                  type="number"
                  value={item.quantity}
                  onChange={(e) =>
                    onUpdateQuantity(item.id, parseInt(e.target.value) || 1)
                  }
                  className="w-16 h-8 text-center"
                  min="1"
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                >
                  <Plus className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  onClick={() => onRemove(item.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t flex justify-between items-center">
              <span className="text-sm text-muted-foreground">
                {item.quantity} × {formatCurrency(item.price)}
              </span>
              <span className="font-semibold">
                {formatCurrency(item.price * item.quantity)}
              </span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
