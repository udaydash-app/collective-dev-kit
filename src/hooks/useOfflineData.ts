/**
 * React hook for fetching data with offline support
 * Caches data in IndexedDB for offline access
 */

import { useEffect, useState } from 'react';
import { offlineDB } from '@/lib/offlineDB';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

export const useOfflineProducts = (storeId?: string) => {
  const [offlineProducts, setOfflineProducts] = useState<any[]>([]);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Fetch from server when online
  const { data: onlineProducts, isLoading } = useQuery({
    queryKey: ['products', storeId],
    queryFn: async () => {
      let query = supabase
        .from('products')
        .select(`
          *,
          product_variants (
            id,
            label,
            quantity,
            unit,
            price,
            is_available,
            is_default
          )
        `)
        .eq('is_available', true)
        .order('name');

      if (storeId) {
        query = query.eq('store_id', storeId);
      }

      const { data, error } = await query.limit(500);
      if (error) throw error;

      // Cache products offline
      if (data) {
        const productsToCache = data.map(p => ({
          ...p,
          lastUpdated: new Date().toISOString()
        }));
        await offlineDB.saveProducts(productsToCache);
      }

      return data || [];
    },
    enabled: !isOffline,
  });

  // Load from IndexedDB when offline
  useEffect(() => {
    if (isOffline) {
      offlineDB.getProducts().then(products => {
        setOfflineProducts(products);
      });
    }
  }, [isOffline]);

  return {
    products: isOffline ? offlineProducts : (onlineProducts || []),
    isLoading: isOffline ? false : isLoading,
    isOffline,
  };
};

export const useOfflineStores = () => {
  const [offlineStores, setOfflineStores] = useState<any[]>([]);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const { data: onlineStores, isLoading } = useQuery({
    queryKey: ['stores'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stores')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;

      // Cache stores offline
      if (data) {
        await offlineDB.saveStores(data);
      }

      return data || [];
    },
    enabled: !isOffline,
  });

  useEffect(() => {
    if (isOffline) {
      offlineDB.getStores().then(stores => {
        setOfflineStores(stores);
      });
    }
  }, [isOffline]);

  return {
    stores: isOffline ? offlineStores : (onlineStores || []),
    isLoading: isOffline ? false : isLoading,
    isOffline,
  };
};

export const useOfflineCategories = () => {
  const [offlineCategories, setOfflineCategories] = useState<any[]>([]);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const { data: onlineCategories, isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name, image_url, icon')
        .eq('is_active', true)
        .order('display_order');

      if (error) throw error;

      // Cache categories offline
      if (data) {
        await offlineDB.saveCategories(data);
      }

      return data || [];
    },
    enabled: !isOffline,
  });

  useEffect(() => {
    if (isOffline) {
      offlineDB.getCategories().then(categories => {
        setOfflineCategories(categories);
      });
    }
  }, [isOffline]);

  return {
    categories: isOffline ? offlineCategories : (onlineCategories || []),
    isLoading: isOffline ? false : isLoading,
    isOffline,
  };
};
