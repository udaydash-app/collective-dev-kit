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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Cart Items ({items.length})</h3>
        <Button variant="ghost" size="sm" onClick={onClear}>
          Clear All
        </Button>
      </div>

      <Card>
        <div className="max-h-[500px] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product name</TableHead>
                <TableHead className="text-center w-[140px]">Qty</TableHead>
                <TableHead className="text-right w-[100px]">Price</TableHead>
                <TableHead className="text-right w-[100px]">Discount</TableHead>
                <TableHead className="text-right w-[120px]">Final Amount</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {item.image_url && (
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="w-10 h-10 object-cover rounded"
                        />
                      )}
                      <span className="font-medium">{item.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <Input
                        type="number"
                        value={item.quantity || ''}
                        onChange={(e) =>
                          onUpdateQuantity(item.id, parseInt(e.target.value) || 1)
                        }
                        className="w-14 h-7 text-center"
                        min="1"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(item.price)}
                  </TableCell>
                  <TableCell className="text-right">
                    {onUpdateDiscount ? (
                      <Input
                        type="number"
                        value={item.itemDiscount || 0}
                        onChange={(e) =>
                          onUpdateDiscount(item.id, parseFloat(e.target.value) || 0)
                        }
                        className="w-20 h-7 text-right ml-auto"
                        min="0"
                        step="0.01"
                      />
                    ) : (
                      formatCurrency(item.itemDiscount || 0)
                    )}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatCurrency(calculateFinalAmount(item))}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => onRemove(item.id)}
                    >
                      <Trash2 className="h-3 w-3" />
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
