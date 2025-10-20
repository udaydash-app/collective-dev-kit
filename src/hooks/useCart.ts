import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface CartItem {
  id: string;
  product_id: string;
  quantity: number;
  products: {
    id: string;
    name: string;
    price: number;
    unit: string;
    image_url: string | null;
  };
}

interface LocalCartItem {
  product_id: string;
  quantity: number;
}

const CART_STORAGE_KEY = 'guest_cart';

export const useCart = () => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    loadCart();
  }, []);

  const loadCart = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // Load from database for logged-in users
        await loadDbCart(user.id);
        setIsGuest(false);
      } else {
        // Load from localStorage for guests
        await loadLocalCart();
        setIsGuest(true);
      }
    } catch (error) {
      console.error('Error loading cart:', error);
      toast.error('Failed to load cart');
    } finally {
      setLoading(false);
    }
  };

  const loadDbCart = async (userId: string) => {
    const { data, error } = await supabase
      .from('cart_items')
      .select(`
        id,
        quantity,
        product_id,
        products (
          id,
          name,
          price,
          unit,
          image_url
        )
      `)
      .eq('user_id', userId);

    if (error) throw error;
    setCartItems(data || []);
  };

  const loadLocalCart = async () => {
    const stored = localStorage.getItem(CART_STORAGE_KEY);
    if (!stored) {
      setCartItems([]);
      return;
    }

    const localItems: LocalCartItem[] = JSON.parse(stored);
    if (localItems.length === 0) {
      setCartItems([]);
      return;
    }

    // Fetch product details for all items
    const productIds = localItems.map(item => item.product_id);
    const { data: products, error } = await supabase
      .from('products')
      .select('id, name, price, unit, image_url')
      .in('id', productIds);

    if (error) throw error;

    const items: CartItem[] = localItems.map(item => {
      const product = products?.find(p => p.id === item.product_id);
      return {
        id: item.product_id, // Use product_id as id for local items
        product_id: item.product_id,
        quantity: item.quantity,
        products: product || {
          id: item.product_id,
          name: 'Unknown Product',
          price: 0,
          unit: '',
          image_url: null
        }
      };
    });

    setCartItems(items);
  };

  const addItem = async (productId: string, quantity: number = 1) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        // Add to database
        const { error } = await supabase
          .from('cart_items')
          .upsert({
            user_id: user.id,
            product_id: productId,
            quantity
          });

        if (error) throw error;
        await loadDbCart(user.id);
      } else {
        // Add to localStorage
        const stored = localStorage.getItem(CART_STORAGE_KEY);
        const localItems: LocalCartItem[] = stored ? JSON.parse(stored) : [];
        
        const existingIndex = localItems.findIndex(item => item.product_id === productId);
        if (existingIndex >= 0) {
          localItems[existingIndex].quantity += quantity;
        } else {
          localItems.push({ product_id: productId, quantity });
        }
        
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(localItems));
        await loadLocalCart();
      }

      toast.success('Added to cart');
    } catch (error) {
      console.error('Error adding to cart:', error);
      toast.error('Failed to add to cart');
    }
  };

  const updateQuantity = async (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { error } = await supabase
          .from('cart_items')
          .update({ quantity: newQuantity })
          .eq('id', itemId);

        if (error) throw error;
        
        setCartItems(items =>
          items.map(item =>
            item.id === itemId ? { ...item, quantity: newQuantity } : item
          )
        );
      } else {
        // Update localStorage
        const stored = localStorage.getItem(CART_STORAGE_KEY);
        const localItems: LocalCartItem[] = stored ? JSON.parse(stored) : [];
        const index = localItems.findIndex(item => item.product_id === itemId);
        
        if (index >= 0) {
          localItems[index].quantity = newQuantity;
          localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(localItems));
          
          setCartItems(items =>
            items.map(item =>
              item.product_id === itemId ? { ...item, quantity: newQuantity } : item
            )
          );
        }
      }
    } catch (error) {
      console.error('Error updating quantity:', error);
      toast.error('Failed to update quantity');
    }
  };

  const removeItem = async (itemId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { error } = await supabase
          .from('cart_items')
          .delete()
          .eq('id', itemId);

        if (error) throw error;
      } else {
        // Remove from localStorage
        const stored = localStorage.getItem(CART_STORAGE_KEY);
        const localItems: LocalCartItem[] = stored ? JSON.parse(stored) : [];
        const filtered = localItems.filter(item => item.product_id !== itemId);
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(filtered));
      }

      setCartItems(items => items.filter(item => 
        user ? item.id !== itemId : item.product_id !== itemId
      ));
      toast.success('Item removed from cart');
    } catch (error) {
      console.error('Error removing item:', error);
      toast.error('Failed to remove item');
    }
  };

  const clearCart = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { error } = await supabase
          .from('cart_items')
          .delete()
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        localStorage.removeItem(CART_STORAGE_KEY);
      }

      setCartItems([]);
    } catch (error) {
      console.error('Error clearing cart:', error);
      toast.error('Failed to clear cart');
    }
  };

  const calculateTotal = () => {
    return cartItems.reduce((total, item) => 
      total + (item.products.price * item.quantity), 0
    );
  };

  return {
    cartItems,
    loading,
    isGuest,
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
    calculateTotal,
    refreshCart: loadCart
  };
};
