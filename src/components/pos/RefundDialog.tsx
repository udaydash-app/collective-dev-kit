import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogDescription,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, CreditCard, Smartphone, Package, ShoppingCart } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { ProductSearch } from './ProductSearch';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CartItem {
  id: string;
  productId?: string;
  name: string;
  price: number;
  quantity: number;
  customPrice?: number;
  itemDiscount?: number;
}

interface RefundDialogProps {
  open: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  storeId: string;
  onRefundComplete: () => void;
}

export function RefundDialog({
  open,
  onClose,
  cartItems,
  storeId,
  onRefundComplete,
}: RefundDialogProps) {
  const [refundMode, setRefundMode] = useState<'payment' | 'exchange'>('payment');
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [exchangeItems, setExchangeItems] = useState<CartItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const paymentMethods = [
    { value: 'cash', label: 'Cash', icon: DollarSign },
    { value: 'card', label: 'Card', icon: CreditCard },
    { value: 'mobile_money', label: 'Mobile Money', icon: Smartphone },
    { value: 'credit', label: 'Credit', icon: CreditCard },
  ];

  // Calculate refund total
  const refundTotal = cartItems.reduce((sum, item) => {
    const price = item.customPrice ?? item.price;
    const itemTotal = price * item.quantity;
    const discount = item.itemDiscount || 0;
    return sum + (itemTotal - discount);
  }, 0);

  // Calculate exchange total
  const exchangeTotal = exchangeItems.reduce((sum, item) => {
    const price = item.customPrice ?? item.price;
    const itemTotal = price * item.quantity;
    const discount = item.itemDiscount || 0;
    return sum + (itemTotal - discount);
  }, 0);

  const netAmount = refundTotal - exchangeTotal;

  const handleAddExchangeProduct = (product: any) => {
    const existingItem = exchangeItems.find(item => item.id === product.id);
    
    if (existingItem) {
      setExchangeItems(prev =>
        prev.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      );
    } else {
      setExchangeItems(prev => [
        ...prev,
        {
          id: product.id,
          name: product.name,
          price: product.price,
          quantity: 1,
        },
      ]);
    }
  };

  const handleRemoveExchangeItem = (itemId: string) => {
    setExchangeItems(prev => prev.filter(item => item.id !== itemId));
  };

  const handleUpdateExchangeQuantity = (itemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      handleRemoveExchangeItem(itemId);
      return;
    }
    
    setExchangeItems(prev =>
      prev.map(item =>
        item.id === itemId ? { ...item, quantity: newQuantity } : item
      )
    );
  };

  const handleProcessRefund = async () => {
    if (cartItems.length === 0) {
      toast.error('No items to refund');
      return;
    }

    if (refundMode === 'exchange' && exchangeItems.length === 0) {
      toast.error('Please add exchange products');
      return;
    }

    setIsProcessing(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Return stock for refunded items
      for (const item of cartItems) {
        if (item.id === 'cart-discount') continue;
        
        // Check if it's a variant or regular product
        const isVariant = item.id !== item.productId;
        
        if (isVariant) {
          // Update variant stock
          const { data: variant, error: fetchError } = await supabase
            .from('product_variants')
            .select('stock_quantity')
            .eq('id', item.id)
            .single();

          if (fetchError) throw fetchError;

          const newStock = (variant?.stock_quantity || 0) + item.quantity;

          const { error: updateError } = await supabase
            .from('product_variants')
            .update({ stock_quantity: newStock })
            .eq('id', item.id);

          if (updateError) throw updateError;
        } else {
          // Update product stock
          const { data: product, error: fetchError } = await supabase
            .from('products')
            .select('stock_quantity')
            .eq('id', item.id)
            .single();

          if (fetchError) throw fetchError;

          const newStock = (product?.stock_quantity || 0) + item.quantity;

          const { error: updateError } = await supabase
            .from('products')
            .update({ stock_quantity: newStock })
            .eq('id', item.id);

          if (updateError) throw updateError;
        }
      }

      // Deduct stock for exchange items
      if (refundMode === 'exchange') {
        for (const item of exchangeItems) {
          const { data: product, error: fetchError } = await supabase
            .from('products')
            .select('stock_quantity')
            .eq('id', item.id)
            .single();

          if (fetchError) throw fetchError;

          const newStock = (product?.stock_quantity || 0) - item.quantity;

          if (newStock < 0) {
            toast.error(`Insufficient stock for ${item.name}`);
            throw new Error(`Insufficient stock for ${item.name}`);
          }

          const { error: updateError } = await supabase
            .from('products')
            .update({ stock_quantity: newStock })
            .eq('id', item.id);

          if (updateError) throw updateError;
        }
      }

      // Create refund transaction record
      const transactionNumber = `REF-${Date.now()}`;
      
      const { error: transactionError } = await supabase
        .from('pos_transactions')
        .insert({
          transaction_number: transactionNumber,
          store_id: storeId,
          cashier_id: user.id,
          subtotal: -refundTotal,
          discount: 0,
          tax: 0,
          total: refundMode === 'payment' ? -refundTotal : -netAmount,
          payment_method: refundMode === 'payment' ? paymentMethod : (netAmount < 0 ? paymentMethod : 'exchange'),
          items: cartItems.map(item => ({
            id: item.id,
            name: item.name,
            quantity: -item.quantity, // Negative for refunds
            price: item.customPrice ?? item.price,
            itemDiscount: item.itemDiscount || 0,
          })),
          metadata: {
            is_refund: true,
            refund_mode: refundMode,
            exchanged_items: refundMode === 'exchange' ? exchangeItems.map(item => ({
              id: item.id,
              name: item.name,
              quantity: item.quantity,
              price: item.price,
            })) : [],
          },
        });

      if (transactionError) throw transactionError;

      // TODO: Create journal entry for the refund if needed
      // This would require adding the RPC function to Supabase

      toast.success(
        refundMode === 'payment'
          ? `Refund processed: ${formatCurrency(refundTotal)}`
          : `Exchange processed. ${netAmount >= 0 ? 'Refund' : 'Additional payment'}: ${formatCurrency(Math.abs(netAmount))}`
      );

      onRefundComplete();
      handleClose();
    } catch (error: any) {
      console.error('Refund error:', error);
      toast.error(error.message || 'Failed to process refund');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setRefundMode('payment');
    setPaymentMethod('cash');
    setExchangeItems([]);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Process Refund</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Refund Items */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Items to Refund
              </h3>
              <div className="space-y-2">
                {cartItems.map((item) => {
                  if (item.id === 'cart-discount') return null;
                  
                  const price = item.customPrice ?? item.price;
                  const itemTotal = price * item.quantity;
                  const discount = item.itemDiscount || 0;
                  const finalAmount = itemTotal - discount;

                  return (
                    <div key={item.id} className="flex justify-between items-center py-2 border-b">
                      <div className="flex-1">
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.quantity} x {formatCurrency(price)}
                          {discount > 0 && ` - ${formatCurrency(discount)} disc`}
                        </p>
                      </div>
                      <p className="font-semibold">{formatCurrency(finalAmount)}</p>
                    </div>
                  );
                })}
                <div className="flex justify-between items-center pt-2 text-lg font-bold">
                  <span>Refund Total:</span>
                  <span className="text-destructive">{formatCurrency(refundTotal)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Refund Mode Selection */}
          <div className="space-y-3">
            <Label className="text-base">Refund Mode</Label>
            <RadioGroup value={refundMode} onValueChange={(value: any) => setRefundMode(value)}>
              <div className="flex items-center space-x-2 p-3 border rounded-lg cursor-pointer hover:bg-accent">
                <RadioGroupItem value="payment" id="payment" />
                <Label htmlFor="payment" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    <div>
                      <p className="font-medium">Payment Refund</p>
                      <p className="text-sm text-muted-foreground">Refund via payment method</p>
                    </div>
                  </div>
                </Label>
              </div>
              <div className="flex items-center space-x-2 p-3 border rounded-lg cursor-pointer hover:bg-accent">
                <RadioGroupItem value="exchange" id="exchange" />
                <Label htmlFor="exchange" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    <div>
                      <p className="font-medium">Exchange with Products</p>
                      <p className="text-sm text-muted-foreground">Exchange for other products</p>
                    </div>
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Payment Method Selection */}
          {refundMode === 'payment' && (
            <div className="space-y-3">
              <Label className="text-base">Refund Payment Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {paymentMethods.map((method) => (
                    <SelectItem key={method.value} value={method.value}>
                      <div className="flex items-center gap-2">
                        <method.icon className="h-4 w-4" />
                        {method.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Exchange Products */}
          {refundMode === 'exchange' && (
            <div className="space-y-3">
              <Label className="text-base">Exchange Products</Label>
              <ProductSearch
                onProductSelect={handleAddExchangeProduct}
              />
              
              {/* Payment method for additional payment in exchange */}
              {netAmount < 0 && exchangeItems.length > 0 && (
                <div className="space-y-3 pt-3 border-t">
                  <Label className="text-base">Payment Method for Additional Amount</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentMethods.map((method) => (
                        <SelectItem key={method.value} value={method.value}>
                          <div className="flex items-center gap-2">
                            <method.icon className="h-4 w-4" />
                            {method.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              {exchangeItems.length > 0 && (
                <Card>
                  <CardContent className="pt-6">
                    <h4 className="font-semibold mb-3">Exchange Items</h4>
                    <div className="space-y-2">
                      {exchangeItems.map((item) => (
                        <div key={item.id} className="flex justify-between items-center py-2 border-b">
                          <div className="flex-1">
                            <p className="font-medium">{item.name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleUpdateExchangeQuantity(item.id, item.quantity - 1)}
                              >
                                -
                              </Button>
                              <span className="text-sm">{item.quantity}</span>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleUpdateExchangeQuantity(item.id, item.quantity + 1)}
                              >
                                +
                              </Button>
                              <span className="text-sm text-muted-foreground ml-2">
                                x {formatCurrency(item.price)}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <p className="font-semibold">{formatCurrency(item.price * item.quantity)}</p>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRemoveExchangeItem(item.id)}
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      ))}
                      <div className="space-y-1 pt-2">
                        <div className="flex justify-between items-center">
                          <span>Exchange Total:</span>
                          <span className="font-semibold">{formatCurrency(exchangeTotal)}</span>
                        </div>
                        <div className="flex justify-between items-center text-lg font-bold">
                          <span>{netAmount >= 0 ? 'Refund Amount:' : 'Additional Payment:'}</span>
                          <span className={netAmount >= 0 ? 'text-destructive' : 'text-primary'}>
                            {formatCurrency(Math.abs(netAmount))}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isProcessing}>
            Cancel
          </Button>
          <Button onClick={handleProcessRefund} disabled={isProcessing}>
            {isProcessing ? 'Processing...' : 'Process Refund'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
