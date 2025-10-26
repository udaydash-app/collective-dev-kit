import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

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
        (payload) => {
          console.log('Products changed:', payload);
          queryClient.invalidateQueries({ queryKey: ['products'] });
          
          if (payload.eventType === 'INSERT') {
            toast.info('New product added');
          } else if (payload.eventType === 'UPDATE') {
            toast.info('Product updated');
          } else if (payload.eventType === 'DELETE') {
            toast.info('Product removed');
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
        () => {
          console.log('Product variants changed');
          queryClient.invalidateQueries({ queryKey: ['products'] });
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
        (payload) => {
          console.log('POS Transaction changed:', payload);
          queryClient.invalidateQueries({ queryKey: ['pos-transactions'] });
          
          if (payload.eventType === 'INSERT') {
            toast.success('Transaction completed! ✅');
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
        (payload) => {
          console.log('Purchases changed:', payload);
          queryClient.invalidateQueries({ queryKey: ['purchases'] });
          
          if (payload.eventType === 'INSERT') {
            toast.info('New purchase recorded');
          } else if (payload.eventType === 'UPDATE') {
            toast.info('Purchase updated');
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
        () => {
          console.log('Categories changed');
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
        () => {
          console.log('Contacts changed');
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
