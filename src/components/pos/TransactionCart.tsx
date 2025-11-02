import { Minus, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency } from '@/lib/utils';
import { CartItem } from '@/hooks/usePOSTransaction';

interface TransactionCartProps {
  items: CartItem[];
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onUpdateDiscount?: (productId: string, discount: number) => void;
  onRemove: (productId: string) => void;
  onClear: () => void;
}

export const TransactionCart = ({
  items,
  onUpdateQuantity,
  onUpdateDiscount,
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

  const calculateFinalAmount = (item: CartItem) => {
    const subtotal = item.price * item.quantity;
    const discountAmount = item.itemDiscount || 0;
    return subtotal - discountAmount;
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Cart Items ({items.length})</h3>
        <Button variant="ghost" size="sm" onClick={onClear} className="h-7 text-xs">
          Clear All
        </Button>
      </div>

      <Card>
        <div className="max-h-[calc(100vh-280px)] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="text-xs">
                <TableHead className="text-xs py-2">Product name</TableHead>
                <TableHead className="text-center text-xs py-2 w-[130px]">Qty</TableHead>
                <TableHead className="text-right text-xs py-2 w-[80px]">Price</TableHead>
                <TableHead className="text-right text-xs py-2 w-[80px]">Discount</TableHead>
                <TableHead className="text-right text-xs py-2 w-[100px]">Final Amount</TableHead>
                <TableHead className="w-[40px] py-2"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id} className="text-xs">
                  <TableCell className="py-2">
                    <span className="text-xs font-medium">{item.name}</span>
                  </TableCell>
                  <TableCell className="py-2">
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                      >
                        <Minus className="h-2.5 w-2.5" />
                      </Button>
                      <Input
                        type="number"
                        value={item.quantity || ''}
                        onChange={(e) =>
                          onUpdateQuantity(item.id, parseInt(e.target.value) || 1)
                        }
                        className="w-12 h-6 text-center text-xs"
                        min="1"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                      >
                        <Plus className="h-2.5 w-2.5" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-xs py-2">
                    {formatCurrency(item.price)}
                  </TableCell>
                  <TableCell className="text-right py-2">
                    {onUpdateDiscount ? (
                      <Input
                        type="number"
                        value={item.itemDiscount || 0}
                        onChange={(e) =>
                          onUpdateDiscount(item.id, parseFloat(e.target.value) || 0)
                        }
                        className="w-16 h-6 text-right text-xs ml-auto"
                        min="0"
                        step="0.01"
                      />
                    ) : (
                      <span className="text-xs">{formatCurrency(item.itemDiscount || 0)}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-semibold text-xs py-2">
                    {formatCurrency(calculateFinalAmount(item))}
                  </TableCell>
                  <TableCell className="py-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive"
                      onClick={() => onRemove(item.id)}
                    >
                      <Trash2 className="h-2.5 w-2.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
};
