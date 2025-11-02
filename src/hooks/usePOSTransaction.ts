import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { offlineDB } from '@/lib/offlineDB';
import { v4 as uuidv4 } from 'uuid';

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

export interface PaymentDetail {
  method: string;
  amount: number;
}

export const usePOSTransaction = () => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  const addToCart = (product: any) => {
    console.log('addToCart called with:', product);
    setCart(prev => {
      // Use variant ID if available, otherwise use product ID
      const cartItemId = product.selectedVariant?.id || product.id;
      const displayName = product.selectedVariant?.label 
        ? `${product.name} (${product.selectedVariant.label})`
        : product.name;
      
      console.log('Cart item ID:', cartItemId, 'Display name:', displayName);
      console.log('Current cart:', prev);
      
      const existing = prev.find(item => item.id === cartItemId);
      if (existing) {
        console.log('Existing item found, incrementing quantity');
        return prev.map(item =>
          item.id === cartItemId
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      
      const newItem = {
        id: cartItemId,
        name: displayName,
        price: Number(product.price),
        quantity: 1,
        barcode: product.barcode,
        image_url: product.image_url,
      };
      console.log('Adding new item to cart:', newItem);
      return [newItem, ...prev];
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
      const itemDiscountAmount = (item.itemDiscount ?? 0) * item.quantity;
      return sum + itemTotal - itemDiscountAmount;
    }, 0);
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    return subtotal - discount;
  };

  const processTransaction = async (
    payments: Array<{ id: string; method: string; amount: number }>,
    storeId: string,
    customerId?: string,
    notes?: string,
    additionalItems?: CartItem[],
    discountOverride?: number
  ) => {
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return null;
    }

    if (!storeId) {
      toast.error('Please select a store');
      return null;
    }

    setIsProcessing(true);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        toast.error('Authentication error. Please log in again.');
        console.error('User error:', userError);
        return null;
      }

      const subtotal = calculateSubtotal();
      const total = calculateTotal();
      
      // Use discount override if provided (for cart-level discounts), otherwise use item-level discount
      const finalDiscount = discountOverride !== undefined ? discountOverride : discount;

      // Determine primary payment method (highest amount)
      const primaryPayment = payments.reduce((prev, current) => 
        (current.amount > prev.amount) ? current : prev
      );

      // Combine cart items with any additional items (like cart discount)
      // Map items to include all necessary fields
      const allItems = additionalItems ? [...cart, ...additionalItems] : cart;
      const itemsToSave = allItems.map(item => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        price: item.price, // Original price
        customPrice: item.customPrice, // Custom/modified price if any
        itemDiscount: item.itemDiscount || 0,
        barcode: item.barcode,
      }));

      const transactionData = {
        id: uuidv4(),
        cashier_id: user.id,
        store_id: storeId,
        customer_id: customerId,
        items: itemsToSave as any,
        subtotal: parseFloat(subtotal.toFixed(2)),
        tax: 0,
        discount: parseFloat(finalDiscount.toFixed(2)),
        total: parseFloat((subtotal - finalDiscount).toFixed(2)),
        payment_method: primaryPayment.method,
        payment_details: payments.map(p => ({
          method: p.method,
          amount: parseFloat(p.amount.toFixed(2)),
        })),
        notes,
      };

      console.log('Processing transaction:', transactionData);

      // Check if online
      if (navigator.onLine) {
        // Try to save online
        const { data, error } = await supabase
          .from('pos_transactions')
          .insert(transactionData)
          .select()
          .single();

        if (error) {
          console.error('Database error:', error);
          // If online but failed, save offline as backup
          await offlineDB.addTransaction({
            id: transactionData.id,
            storeId: transactionData.store_id,
            cashierId: transactionData.cashier_id,
            customerId: transactionData.customer_id,
            items: transactionData.items,
            subtotal: transactionData.subtotal,
            discount: transactionData.discount,
            total: transactionData.total,
            paymentMethod: transactionData.payment_method,
            notes: transactionData.notes,
            timestamp: new Date().toISOString(),
            synced: false,
          });
          toast.warning('Saved offline - will sync when connection is stable');
          clearCart();
          return { ...transactionData, offline: true };
        }

        toast.success('Transaction completed successfully!');
        clearCart();
        return data;
      } else {
        // Save offline
        await offlineDB.addTransaction({
          id: transactionData.id,
          storeId: transactionData.store_id,
          cashierId: transactionData.cashier_id,
          customerId: transactionData.customer_id,
          items: transactionData.items,
          subtotal: transactionData.subtotal,
          discount: transactionData.discount,
          total: transactionData.total,
          paymentMethod: transactionData.payment_method,
          notes: transactionData.notes,
          timestamp: new Date().toISOString(),
          synced: false,
        });
        
        toast.success('Transaction saved offline - will sync automatically');
        clearCart();
        return { ...transactionData, offline: true };
      }
    } catch (error: any) {
      console.error('Transaction error:', error);
      
      // Last resort: save offline
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const subtotal = calculateSubtotal();
          const total = calculateTotal();
          const primaryPayment = payments.reduce((prev, current) => 
            (current.amount > prev.amount) ? current : prev
          );
          
          // Combine cart items with any additional items (like cart discount)
          const allItemsForOffline = additionalItems ? [...cart, ...additionalItems] : cart;
          const itemsForOffline = allItemsForOffline.map(item => ({
            id: item.id,
            name: item.name,
            quantity: item.quantity,
            price: item.price, // Original price
            customPrice: item.customPrice, // Custom/modified price if any
            itemDiscount: item.itemDiscount || 0,
            barcode: item.barcode,
          }));
          
          const finalDiscountOffline = discountOverride !== undefined ? discountOverride : discount;
          
          await offlineDB.addTransaction({
            id: uuidv4(),
            storeId,
            cashierId: user.id,
            customerId,
            items: itemsForOffline as any,
            subtotal: parseFloat(subtotal.toFixed(2)),
            discount: parseFloat(finalDiscountOffline.toFixed(2)),
            total: parseFloat((subtotal - finalDiscountOffline).toFixed(2)),
            paymentMethod: primaryPayment.method,
            notes,
            timestamp: new Date().toISOString(),
            synced: false,
          });
          
          toast.warning('Saved offline due to error - will retry sync automatically');
          clearCart();
          return { offline: true };
        }
      } catch (offlineError) {
        console.error('Failed to save offline:', offlineError);
      }
      
      toast.error(error?.message || 'Failed to process transaction');
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
    calculateTotal,
    processTransaction,
    isProcessing,
  };
};
