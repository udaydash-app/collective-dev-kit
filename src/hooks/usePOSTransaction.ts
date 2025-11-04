import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { offlineDB } from '@/lib/offlineDB';
import { v4 as uuidv4 } from 'uuid';

export interface CartItem {
  id: string;
  productId: string; // Base product ID (for looking up custom prices)
  name: string;
  price: number;
  quantity: number;
  barcode?: string;
  image_url?: string;
  itemDiscount?: number;
  customPrice?: number;
  isCombo?: boolean;
  comboId?: string;
  comboItems?: Array<{
    product_id: string;
    variant_id?: string;
    quantity: number;
    product_name: string;
  }>;
}

export interface PaymentDetail {
  method: string;
  amount: number;
}

export const usePOSTransaction = () => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  // Helper function to fetch active combos
  const fetchActiveCombos = async () => {
    try {
      const { data, error } = await supabase
        .from('combo_offers')
        .select(`
          id,
          name,
          combo_price,
          combo_offer_items (
            product_id,
            variant_id,
            quantity,
            products (
              id,
              name,
              price
            ),
            product_variants (
              id,
              label,
              price
            )
          )
        `)
        .eq('is_active', true);
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching combos:', error);
      // Fallback to offline DB
      try {
        return await offlineDB.getComboOffers();
      } catch (offlineError) {
        console.error('Error fetching offline combos:', offlineError);
        return [];
      }
    }
  };

  // Automatic combo detection and application
  const detectAndApplyCombos = async (currentCart: CartItem[]): Promise<CartItem[]> => {
    try {
      console.log('detectAndApplyCombos called with cart:', currentCart);
      const combos = await fetchActiveCombos();
      console.log('Active combos fetched:', combos);
      if (!combos || combos.length === 0) {
        console.log('No active combos found, returning original cart');
        return currentCart;
      }

      // Filter out existing combo items and cart-discount items
      let regularItems = currentCart.filter(item => !item.isCombo && item.id !== 'cart-discount');
      const appliedCombos: CartItem[] = [];

      // Try to apply each combo
      for (const combo of combos) {
        if (!combo.combo_offer_items || combo.combo_offer_items.length === 0) continue;

        // Keep trying to form combos while possible
        while (true) {
          // Check if we have enough products to form this combo
          let canFormCombo = true;
          const requiredProducts = combo.combo_offer_items.map(item => ({
            id: item.variant_id || item.product_id,
            requiredQty: item.quantity,
            product_id: item.product_id,
            variant_id: item.variant_id,
            product_name: item.variant_id 
              ? `${item.products?.name} (${item.product_variants?.label})`
              : item.products?.name,
          }));

          // Calculate available quantities for each required product
          for (const required of requiredProducts) {
            const cartItem = regularItems.find(item => item.id === required.id);
            if (!cartItem || cartItem.quantity < required.requiredQty) {
              canFormCombo = false;
              break;
            }
          }

          if (!canFormCombo) break;

          // Form the combo - reduce quantities of regular items
          regularItems = regularItems.map(item => {
            const required = requiredProducts.find(req => req.id === item.id);
            if (required) {
              return {
                ...item,
                quantity: item.quantity - required.requiredQty,
              };
            }
            return item;
          }).filter(item => item.quantity > 0); // Remove items with 0 quantity

          // Add combo to cart
          const comboCartItem: CartItem = {
            id: `combo-${combo.id}-${Date.now()}-${Math.random()}`,
            productId: combo.id,
            comboId: combo.id,
            name: combo.name,
            price: combo.combo_price,
            quantity: 1,
            itemDiscount: 0,
            isCombo: true,
            comboItems: combo.combo_offer_items.map((item: any) => ({
              product_id: item.product_id,
              variant_id: item.variant_id,
              quantity: item.quantity,
              product_name: item.variant_id 
                ? `${item.products?.name} (${item.product_variants?.label})`
                : item.products?.name,
            })),
          };
          
          appliedCombos.push(comboCartItem);
        }
      }

      // Show toast if combos were applied
      if (appliedCombos.length > 0) {
        const comboCount = appliedCombos.length;
        const comboNames = [...new Set(appliedCombos.map(c => c.name))].join(', ');
        toast.success(`${comboCount} combo${comboCount > 1 ? 's' : ''} applied: ${comboNames}`);
      }

      // Return combined cart: regular items + applied combos
      const finalCart = [...regularItems, ...appliedCombos];
      console.log('Final cart after combo detection:', finalCart);
      return finalCart;
    } catch (error) {
      console.error('Error in detectAndApplyCombos:', error);
      return currentCart;
    }
  };

  const addToCart = async (product: any) => {
    console.log('addToCart called with:', product);
    
    // Create updated cart with new product
    const cartItemId = product.selectedVariant?.id || product.id;
    const baseProductId = product.id;
    const displayName = product.selectedVariant?.label 
      ? `${product.name} (${product.selectedVariant.label})`
      : product.name;
    
    let updatedCart: CartItem[];
    const existing = cart.find(item => item.id === cartItemId);
    
    if (existing) {
      updatedCart = cart.map(item =>
        item.id === cartItemId
          ? { ...item, quantity: item.quantity + 1 }
          : item
      );
    } else {
      const newItem: CartItem = {
        id: cartItemId,
        productId: baseProductId,
        name: displayName,
        price: Number(product.price),
        quantity: 1,
        barcode: product.barcode,
        image_url: product.image_url,
      };
      updatedCart = [newItem, ...cart];
    }
    
    // Apply combo detection
    const cartWithCombos = await detectAndApplyCombos(updatedCart);
    setCart(cartWithCombos);
    
    toast.success(`${product.name} added to cart`);
  };

  const removeFromCart = async (productId: string) => {
    const updatedCart = cart.filter(item => item.id !== productId);
    
    // Reapply combo detection after removal
    const cartWithCombos = await detectAndApplyCombos(updatedCart);
    setCart(cartWithCombos);
  };

  const updateQuantity = async (productId: string, quantity: number) => {
    if (quantity <= 0) {
      await removeFromCart(productId);
      return;
    }
    
    const updatedCart = cart.map(item =>
      item.id === productId ? { ...item, quantity } : item
    );
    
    // Reapply combo detection after quantity update
    const cartWithCombos = await detectAndApplyCombos(updatedCart);
    setCart(cartWithCombos);
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

  const addComboToCart = (combo: any) => {
    const comboCartItem: CartItem = {
      id: `combo-${combo.id}-${Date.now()}`,
      productId: combo.id,
      comboId: combo.id,
      name: `🎁 ${combo.name}`,
      price: combo.combo_price,
      quantity: 1,
      itemDiscount: 0,
      isCombo: true,
      comboItems: combo.combo_offer_items?.map((item: any) => ({
        product_id: item.product_id,
        variant_id: item.variant_id,
        quantity: item.quantity,
        product_name: item.variant_id 
          ? `${item.products?.name} (${item.product_variants?.label})`
          : item.products?.name,
      })) || [],
    };
    
    setCart(prev => [...prev, comboCartItem]);
    toast.success(`Added ${combo.name} to cart`);
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
        productId: item.productId, // Base product ID for custom pricing
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

        // Update stock quantities for sold items
        for (const item of cart) {
          if (item.id === 'cart-discount') continue; // Skip cart discount items
          
          // Handle combo items - deduct stock from each product in the combo
          if (item.isCombo && item.comboItems) {
            for (const comboProduct of item.comboItems) {
              const stockToDeduct = comboProduct.quantity * item.quantity;
              
              if (comboProduct.variant_id) {
                const { error: variantError } = await supabase.rpc('decrement_variant_stock', {
                  p_variant_id: comboProduct.variant_id,
                  p_quantity: stockToDeduct
                });
                
                if (variantError) {
                  console.error('Error updating combo variant stock:', variantError);
                }
              } else {
                const { error: stockError } = await supabase.rpc('decrement_product_stock', {
                  p_product_id: comboProduct.product_id,
                  p_quantity: stockToDeduct
                });
                
                if (stockError) {
                  console.error('Error updating combo product stock:', stockError);
                }
              }
            }
          } else {
            // Regular product stock deduction
            // Check if this is a variant or base product
            const isVariant = item.id !== item.productId;
            
            if (isVariant) {
              // Update variant stock
              const { error: variantError } = await supabase.rpc('decrement_variant_stock', {
                p_variant_id: item.id,
                p_quantity: item.quantity
              });
              
              if (variantError) {
                console.error('Error updating variant stock:', variantError);
              }
            } else {
              // Update base product stock
              const { error: stockError } = await supabase.rpc('decrement_product_stock', {
                p_product_id: item.id,
                p_quantity: item.quantity
              });
              
              if (stockError) {
                console.error('Error updating product stock:', stockError);
              }
            }
          }
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
            productId: item.productId, // Base product ID for custom pricing
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
