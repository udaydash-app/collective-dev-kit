// Updated: 2025-11-02 - Editable price and final amount
import { Fragment } from 'react';
import { Minus, Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, cn } from '@/lib/utils';
import { CartItem } from '@/hooks/usePOSTransaction';
import { z } from 'zod';
import { toast } from 'sonner';
import { useState } from 'react';

const priceSchema = z.number().nonnegative().max(1000000);
const amountSchema = z.number().nonnegative().max(10000000);

interface TransactionCartProps {
  items: CartItem[];
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onUpdateDiscount?: (productId: string, discount: number) => void;
  onRemove: (productId: string) => void;
  onClear: () => void;
  selectedItemId?: string;
  onSelectItem?: (productId: string) => void;
  onUpdatePrice?: (productId: string, price: number) => void;
  onUpdateDisplayName?: (productId: string, displayName: string) => void;
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
  onUpdateDisplayName,
}: TransactionCartProps) => {
  const [expandedCombos, setExpandedCombos] = useState<Set<string>>(new Set());

  const toggleComboExpansion = (itemId: string) => {
    setExpandedCombos(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

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
    const effectivePrice = item.customPrice ?? item.price;
    const subtotal = effectivePrice * item.quantity;
    const discountAmount = (item.itemDiscount || 0) * item.quantity;
    return subtotal - discountAmount;
  };

  const handlePriceChange = (item: CartItem, newPrice: number) => {
    try {
      const validated = priceSchema.parse(newPrice);
      onUpdatePrice?.(item.id, validated);
      // Clear item discount when price is manually changed
      if (item.itemDiscount && item.itemDiscount > 0) {
        onUpdateDiscount?.(item.id, 0);
      }
    } catch (error) {
      toast.error('Invalid price. Must be between 0.01 and 1,000,000');
    }
  };

  const handleFinalAmountChange = (item: CartItem, newFinalAmount: number) => {
    try {
      const validated = amountSchema.parse(newFinalAmount);
      // Back-calculate the price per unit based on new final amount
      const newPricePerUnit = validated / item.quantity;
      const validatedPrice = priceSchema.parse(newPricePerUnit);
      onUpdatePrice?.(item.id, validatedPrice);
      // Clear item discount when editing final amount
      onUpdateDiscount?.(item.id, 0);
    } catch (error) {
      toast.error('Invalid amount. Must be between 0 and 10,000,000');
    }
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
                <TableHead className="text-[10px] py-1 px-1">Product name</TableHead>
                <TableHead className="text-center text-[10px] py-1 px-1 w-[110px]">Qty</TableHead>
                <TableHead className="text-right text-[10px] py-1 px-1 w-[70px]">Price</TableHead>
                <TableHead className="text-right text-[10px] py-1 px-1 w-[70px]">Disc</TableHead>
                <TableHead className="text-right text-[10px] py-1 px-1 w-[85px]">Final</TableHead>
                <TableHead className="w-[35px] py-1 px-1"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const isCartDiscount = item.id === 'cart-discount';
                const isCombo = item.isCombo;
                const isExpanded = expandedCombos.has(item.id);
                return (
                  <Fragment key={item.id}>
                    <TableRow
                      className={cn(
                        "text-xs transition-colors",
                        !isCartDiscount && "cursor-pointer",
                        selectedItemId === item.id && "bg-primary/10 hover:bg-primary/15",
                        isCartDiscount && "bg-orange-50 dark:bg-orange-950/20",
                        isCombo && "bg-green-50 dark:bg-green-950/20"
                      )}
                      onClick={() => !isCartDiscount && onSelectItem?.(item.id)}
                    >
                      <TableCell className="py-1 px-1">
                        <div className="flex items-center gap-1">
                          {isCombo && item.comboItems && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-4 w-4 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleComboExpansion(item.id);
                              }}
                            >
                              {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                            </Button>
                          )}
                          {isCartDiscount ? (
                            <span className="text-[10px] font-medium line-clamp-2 text-orange-600 dark:text-orange-400">
                              {item.name}
                            </span>
                          ) : (
                            <Input
                              type="text"
                              value={item.displayName ?? item.name}
                              onChange={(e) => {
                                e.stopPropagation();
                                onUpdateDisplayName?.(item.id, e.target.value);
                              }}
                              placeholder={item.name}
                              className="text-[10px] font-medium px-1 py-0 h-auto min-h-[20px] border-0 bg-transparent hover:bg-muted/50 focus-visible:bg-muted focus-visible:ring-1 focus-visible:ring-primary/20"
                              onClick={(e) => e.stopPropagation()}
                              title="Click to edit display name for this order"
                            />
                          )}
                          {isCombo && (
                            <Badge variant="secondary" className="text-[8px] px-1 h-4 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                              COMBO APPLIED
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                    <TableCell className="py-1 px-1">
                      {!isCartDiscount ? (
                        <div className="flex items-center justify-center gap-0.5">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-5 w-5"
                            onClick={(e) => {
                              e.stopPropagation();
                              onUpdateQuantity(item.id, item.quantity - 1);
                            }}
                          >
                            <Minus className="h-2 w-2" />
                          </Button>
                          <Input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => {
                              e.stopPropagation();
                              onUpdateQuantity(item.id, parseInt(e.target.value) || 1);
                            }}
                            className="w-10 h-5 text-center text-[10px] px-0 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                            min="1"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-5 w-5"
                            onClick={(e) => {
                              e.stopPropagation();
                              onUpdateQuantity(item.id, item.quantity + 1);
                            }}
                          >
                            <Plus className="h-2 w-2" />
                          </Button>
                        </div>
                      ) : (
                        <span className="text-center block text-[10px] text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right py-1 px-1">
                      {!isCartDiscount && onUpdatePrice ? (
                          <Input
                            type="number"
                            value={item.customPrice ?? item.price}
                            onChange={(e) => {
                              e.stopPropagation();
                              const newPrice = parseFloat(e.target.value);
                              if (!isNaN(newPrice) && newPrice >= 0) {
                                handlePriceChange(item, newPrice);
                              }
                            }}
                            className="w-16 h-5 text-right text-[10px] px-1 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                            min="0"
                            step="0.01"
                            onClick={(e) => e.stopPropagation()}
                          />
                      ) : !isCartDiscount ? (
                        <span className="text-[10px]">{formatCurrency(Math.abs(item.customPrice ?? item.price))}</span>
                      ) : (
                        ''
                      )}
                    </TableCell>
                    <TableCell className="text-right py-1 px-1">
                      {!isCartDiscount && onUpdateDiscount ? (
                        item.itemDiscount && item.itemDiscount > 0 ? (
                          <Input
                            type="number"
                            value={item.itemDiscount}
                            onChange={(e) => {
                              e.stopPropagation();
                              onUpdateDiscount(item.id, parseFloat(e.target.value) || 0);
                            }}
                            className="w-14 h-5 text-right text-[10px] ml-auto px-1 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                            min="0"
                            step="0.01"
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <span className="text-[10px]"></span>
                        )
                      ) : !isCartDiscount && item.itemDiscount && item.itemDiscount > 0 ? (
                        <span className="text-[10px]">{formatCurrency(item.itemDiscount)}</span>
                      ) : (
                        ''
                      )}
                    </TableCell>
                    <TableCell className="text-right py-1 px-1">
                      {!isCartDiscount && onUpdatePrice ? (
                        <Input
                          type="number"
                          value={calculateFinalAmount(item).toFixed(2)}
                          onChange={(e) => {
                            e.stopPropagation();
                            const newAmount = parseFloat(e.target.value);
                            if (!isNaN(newAmount) && newAmount >= 0) {
                              handleFinalAmountChange(item, newAmount);
                            }
                          }}
                          className="w-20 h-5 text-right text-[10px] font-semibold px-1 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                          min="0"
                          step="0.01"
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span className="font-semibold text-[10px]">{formatCurrency(calculateFinalAmount(item))}</span>
                      )}
                    </TableCell>
                    <TableCell className="py-1 px-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemove(item.id);
                        }}
                      >
                        <Trash2 className="h-2 w-2" />
                      </Button>
                    </TableCell>
                  </TableRow>
                  {isCombo && isExpanded && item.comboItems && (
                    <TableRow key={`${item.id}-details`}>
                      <TableCell colSpan={6} className="py-1 px-1 bg-muted/30">
                        <div className="text-[9px] text-muted-foreground ml-6">
                          <span className="font-semibold">Includes: </span>
                          {item.comboItems.map((ci, idx) => (
                            <span key={idx}>
                              {ci.quantity}x {ci.product_name}
                              {idx < item.comboItems!.length - 1 ? ', ' : ''}
                            </span>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
};
