import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  barcode?: string;
  image_url?: string;
  itemDiscount?: number;
  customPrice?: number;
}

export const usePOSTransaction = () => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  const addToCart = (product: any) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, {
        id: product.id,
        name: product.name,
        price: Number(product.price),
        quantity: 1,
        barcode: product.barcode,
        image_url: product.image_url,
      }];
    });
    toast.success(`${product.name} added to cart`);
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.id !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart(prev =>
      prev.map(item =>
        item.id === productId ? { ...item, quantity } : item
      )
    );
  };

  const updateItemPrice = (productId: string, price: number) => {
    setCart(prev =>
      prev.map(item =>
        item.id === productId ? { ...item, customPrice: price } : item
      )
    );
  };

  const updateItemDiscount = (productId: string, discount: number) => {
    setCart(prev =>
      prev.map(item =>
        item.id === productId ? { ...item, itemDiscount: discount } : item
      )
    );
  };

  const clearCart = () => {
    setCart([]);
    setDiscount(0);
  };

  const calculateSubtotal = () => {
    return cart.reduce((sum, item) => {
      const effectivePrice = item.customPrice ?? item.price;
      const itemTotal = effectivePrice * item.quantity;
      const itemDiscountAmount = item.itemDiscount ?? 0;
      return sum + itemTotal - itemDiscountAmount;
    }, 0);
  };

  const calculateTax = (subtotal: number) => {
    return subtotal * 0.15; // 15% tax
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const tax = calculateTax(subtotal);
    return subtotal + tax - discount;
  };

  const processTransaction = async (paymentMethod: string, storeId: string) => {
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return null;
    }

    setIsProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const subtotal = calculateSubtotal();
      const tax = calculateTax(subtotal);
      const total = calculateTotal();

      const { data, error } = await supabase
        .from('pos_transactions')
        .insert({
          cashier_id: user.id,
          store_id: storeId,
          items: cart as any,
          subtotal: parseFloat(subtotal.toFixed(2)),
          tax: parseFloat(tax.toFixed(2)),
          discount: parseFloat(discount.toFixed(2)),
          total: parseFloat(total.toFixed(2)),
          payment_method: paymentMethod,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Transaction completed successfully!');
      clearCart();
      return data;
    } catch (error) {
      console.error('Transaction error:', error);
      toast.error('Failed to process transaction');
      return null;
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    cart,
    discount,
    setDiscount,
    addToCart,
    removeFromCart,
    updateQuantity,
    updateItemPrice,
    updateItemDiscount,
    clearCart,
    calculateSubtotal,
    calculateTax,
    calculateTotal,
    processTransaction,
    isProcessing,
  };
};
