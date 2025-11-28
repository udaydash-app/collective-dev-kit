import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { offlineDB } from '@/lib/offlineDB';

export const useRealtimeSync = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Products realtime sync
    const productsChannel = supabase
      .channel('products-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'products'
        },
        async (payload) => {
          console.log('Products changed:', payload);
          
          // Update local cache for cross-device sync
          const { data: products } = await supabase
            .from('products')
            .select('*')
            .eq('is_available', true);
          if (products) {
            await offlineDB.saveProducts(products.map(p => ({ ...p, lastUpdated: new Date().toISOString() })));
          }
          
          queryClient.invalidateQueries({ queryKey: ['products'] });
          queryClient.invalidateQueries({ queryKey: ['products-stock-price'] });
          queryClient.invalidateQueries({ queryKey: ['stock-products'] });
          queryClient.invalidateQueries({ queryKey: ['pos-products'] });
          
          if (payload.eventType === 'INSERT') {
            toast.info('Product synced from another device');
          } else if (payload.eventType === 'UPDATE') {
            toast.info('Product updated on another device');
          }
        }
      )
      .subscribe();

    // Product variants realtime sync
    const variantsChannel = supabase
      .channel('product-variants-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'product_variants'
        },
        async () => {
          console.log('Product variants changed');
          
          // Update local cache for cross-device sync
          const { data: products } = await supabase
            .from('products')
            .select('*')
            .eq('is_available', true);
          if (products) {
            await offlineDB.saveProducts(products.map(p => ({ ...p, lastUpdated: new Date().toISOString() })));
          }
          
          queryClient.invalidateQueries({ queryKey: ['products'] });
          queryClient.invalidateQueries({ queryKey: ['products-stock-price'] });
          queryClient.invalidateQueries({ queryKey: ['stock-products'] });
          queryClient.invalidateQueries({ queryKey: ['pos-products'] });
        }
      )
      .subscribe();

    // Orders realtime sync
    const ordersChannel = supabase
      .channel('orders-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders'
        },
        (payload) => {
          console.log('Orders changed:', payload);
          queryClient.invalidateQueries({ queryKey: ['orders'] });
          queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
          
          if (payload.eventType === 'INSERT') {
            toast.success('New order received! 🛒', {
              description: `Order #${payload.new.order_number}`,
              duration: 5000,
            });
            // Play notification sound
            const audio = new Audio('/notification.mp3');
            audio.play().catch(() => {});
          } else if (payload.eventType === 'UPDATE') {
            toast.info('Order status updated');
          }
        }
      )
      .subscribe();

    // POS Transactions realtime sync
    const posTransactionsChannel = supabase
      .channel('pos-transactions-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pos_transactions'
        },
        async (payload) => {
          console.log('POS Transaction changed:', payload);
          
          // Update local product cache after transaction (stock changed)
          const { data: products } = await supabase
            .from('products')
            .select('*')
            .eq('is_available', true);
          if (products) {
            await offlineDB.saveProducts(products.map(p => ({ ...p, lastUpdated: new Date().toISOString() })));
          }
          
          queryClient.invalidateQueries({ queryKey: ['pos-transactions'] });
          queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
          queryClient.invalidateQueries({ queryKey: ['products'] });
          queryClient.invalidateQueries({ queryKey: ['pos-products'] });
          
          if (payload.eventType === 'INSERT') {
            toast.success('Sale synced from another device ✅');
          }
        }
      )
      .subscribe();

    // Purchases realtime sync
    const purchasesChannel = supabase
      .channel('purchases-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'purchases'
        },
        async (payload) => {
          console.log('Purchases changed:', payload);
          
          // Update local product cache after purchase (stock changed)
          const { data: products } = await supabase
            .from('products')
            .select('*')
            .eq('is_available', true);
          if (products) {
            await offlineDB.saveProducts(products.map(p => ({ ...p, lastUpdated: new Date().toISOString() })));
          }
          
          queryClient.invalidateQueries({ queryKey: ['purchases'] });
          queryClient.invalidateQueries({ queryKey: ['products'] });
          queryClient.invalidateQueries({ queryKey: ['pos-products'] });
          
          if (payload.eventType === 'INSERT') {
            toast.info('Purchase synced from another device');
          }
        }
      )
      .subscribe();

    // Categories realtime sync
    const categoriesChannel = supabase
      .channel('categories-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'categories'
        },
        async () => {
          console.log('Categories changed');
          
          // Update local cache for cross-device sync
          const { data: categories } = await supabase
            .from('categories')
            .select('*')
            .eq('is_active', true);
          if (categories) {
            await offlineDB.saveCategories(categories);
          }
          
          queryClient.invalidateQueries({ queryKey: ['categories'] });
        }
      )
      .subscribe();

    // Contacts realtime sync
    const contactsChannel = supabase
      .channel('contacts-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'contacts'
        },
        async () => {
          console.log('Contacts changed');
          
          // Update local cache for cross-device sync
          const { data: customers } = await supabase
            .from('contacts')
            .select('*')
            .eq('is_customer', true);
          if (customers) {
            await offlineDB.saveCustomers(customers);
          }
          
          queryClient.invalidateQueries({ queryKey: ['contacts'] });
        }
      )
      .subscribe();

    // Cleanup on unmount
    return () => {
      supabase.removeChannel(productsChannel);
      supabase.removeChannel(variantsChannel);
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(posTransactionsChannel);
      supabase.removeChannel(purchasesChannel);
      supabase.removeChannel(categoriesChannel);
      supabase.removeChannel(contactsChannel);
    };
  }, [queryClient]);

  return null;
};
