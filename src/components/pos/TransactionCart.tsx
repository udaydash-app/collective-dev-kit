import { Minus, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency, cn } from '@/lib/utils';
import { CartItem } from '@/hooks/usePOSTransaction';

interface TransactionCartProps {
  items: CartItem[];
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onUpdateDiscount?: (productId: string, discount: number) => void;
  onRemove: (productId: string) => void;
  onClear: () => void;
  selectedItemId?: string;
  onSelectItem?: (productId: string) => void;
  onUpdatePrice?: (productId: string, price: number) => void;
}

export const TransactionCart = ({
  items,
  onUpdateQuantity,
  onUpdateDiscount,
  onRemove,
  onClear,
  selectedItemId,
  onSelectItem,
  onUpdatePrice,
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
    <div className="space-y-1 h-full flex flex-col">
      <div className="flex items-center justify-between px-2">
        <h3 className="font-semibold text-sm">Cart Items ({items.filter(item => item.id !== 'cart-discount').length})</h3>
        <Button variant="ghost" size="sm" onClick={onClear} className="h-7 text-xs px-2">
          Clear All
        </Button>
      </div>

      <Card className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow className="text-xs">
                <TableHead className="text-xs py-1.5">Product name</TableHead>
                <TableHead className="text-center text-xs py-1.5 w-[130px]">Qty</TableHead>
                <TableHead className="text-right text-xs py-1.5 w-[80px]">Price</TableHead>
                <TableHead className="text-right text-xs py-1.5 w-[80px]">Discount</TableHead>
                <TableHead className="text-right text-xs py-1.5 w-[100px]">Final Amount</TableHead>
                <TableHead className="w-[40px] py-1.5"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const isCartDiscount = item.id === 'cart-discount';
                return (
                  <TableRow 
                    key={item.id} 
                    className={cn(
                      "text-xs transition-colors",
                      !isCartDiscount && "cursor-pointer",
                      selectedItemId === item.id && "bg-primary/10 hover:bg-primary/15",
                      isCartDiscount && "bg-orange-50 dark:bg-orange-950/20"
                    )}
                    onClick={() => !isCartDiscount && onSelectItem?.(item.id)}
                  >
                    <TableCell className="py-1.5">
                      <span className={cn("text-xs font-medium", isCartDiscount && "text-orange-600 dark:text-orange-400")}>{item.name}</span>
                    </TableCell>
                    <TableCell className="py-1.5">
                      {!isCartDiscount ? (
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-6 w-6"
                            onClick={(e) => {
                              e.stopPropagation();
                              onUpdateQuantity(item.id, item.quantity - 1);
                            }}
                          >
                            <Minus className="h-2.5 w-2.5" />
                          </Button>
                          <Input
                            type="number"
                            value={item.quantity || ''}
                            onChange={(e) => {
                              e.stopPropagation();
                              onUpdateQuantity(item.id, parseInt(e.target.value) || 1);
                            }}
                            className="w-12 h-6 text-center text-xs"
                            min="1"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-6 w-6"
                            onClick={(e) => {
                              e.stopPropagation();
                              onUpdateQuantity(item.id, item.quantity + 1);
                            }}
                          >
                            <Plus className="h-2.5 w-2.5" />
                          </Button>
                        </div>
                      ) : (
                        <span className="text-center block text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-xs py-1.5">
                      {formatCurrency(Math.abs(item.price))}
                    </TableCell>
                    <TableCell className="text-right py-1.5">
                      {!isCartDiscount && onUpdateDiscount ? (
                        <Input
                          type="number"
                          value={item.itemDiscount || 0}
                          onChange={(e) => {
                            e.stopPropagation();
                            onUpdateDiscount(item.id, parseFloat(e.target.value) || 0);
                          }}
                          className="w-16 h-6 text-right text-xs ml-auto"
                          min="0"
                          step="0.01"
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span className="text-xs">{formatCurrency(item.itemDiscount || 0)}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-xs py-1.5">
                      {formatCurrency(calculateFinalAmount(item))}
                    </TableCell>
                    <TableCell className="py-1.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemove(item.id);
                        }}
                      >
                        <Trash2 className="h-2.5 w-2.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
};
