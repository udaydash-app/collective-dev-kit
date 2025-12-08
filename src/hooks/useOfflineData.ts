/**
 * React hook for fetching data with offline support
 * Caches data in IndexedDB for offline access
 * Prioritizes local IndexedDB when in local LAN mode for speed
 */

import { useEffect, useState } from 'react';
import { offlineDB } from '@/lib/offlineDB';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { shouldUseLocalData } from '@/lib/localModeHelper';

export const useOfflineProducts = (storeId?: string) => {
  const [localProducts, setLocalProducts] = useState<any[]>([]);
  const [useLocal, setUseLocal] = useState(shouldUseLocalData());

  useEffect(() => {
    const handleOnline = () => setUseLocal(shouldUseLocalData());
    const handleOffline = () => setUseLocal(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load from IndexedDB immediately for local/offline mode
  useEffect(() => {
    if (useLocal) {
      offlineDB.getProducts().then(products => {
        setLocalProducts(products);
      });
    }
  }, [useLocal]);

  // Fetch from server when online AND not in local mode
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
    enabled: !useLocal,
  });

  return {
    products: useLocal ? localProducts : (onlineProducts || []),
    isLoading: useLocal ? false : isLoading,
    isOffline: useLocal,
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

export const useOfflineAccounts = () => {
  const [offlineAccounts, setOfflineAccounts] = useState<any[]>([]);
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

  const { data: onlineAccounts, isLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('is_active', true)
        .order('account_code');

      if (error) throw error;

      if (data) {
        await offlineDB.saveAccounts(data);
      }

      return data || [];
    },
    enabled: !isOffline,
  });

  useEffect(() => {
    if (isOffline) {
      offlineDB.getAccounts().then(accounts => {
        setOfflineAccounts(accounts);
      });
    }
  }, [isOffline]);

  return {
    accounts: isOffline ? offlineAccounts : (onlineAccounts || []),
    isLoading: isOffline ? false : isLoading,
    isOffline,
  };
};

export const useOfflineBogoOffers = () => {
  const [offlineOffers, setOfflineOffers] = useState<any[]>([]);
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

  const { data: onlineOffers, isLoading } = useQuery({
    queryKey: ['bogo-offers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bogo_offers')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;

      if (data) {
        await offlineDB.saveBogoOffers(data);
      }

      return data || [];
    },
    enabled: !isOffline,
  });

  useEffect(() => {
    if (isOffline) {
      offlineDB.getBogoOffers().then(offers => {
        setOfflineOffers(offers);
      });
    }
  }, [isOffline]);

  return {
    offers: isOffline ? offlineOffers : (onlineOffers || []),
    isLoading: isOffline ? false : isLoading,
    isOffline,
  };
};

export const useOfflineMultiProductBogoOffers = () => {
  const [offlineOffers, setOfflineOffers] = useState<any[]>([]);
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

  const { data: onlineOffers, isLoading } = useQuery({
    queryKey: ['multi-product-bogo-offers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('multi_product_bogo_offers')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;

      if (data) {
        await offlineDB.saveMultiProductBogoOffers(data);
      }

      return data || [];
    },
    enabled: !isOffline,
  });

  useEffect(() => {
    if (isOffline) {
      offlineDB.getMultiProductBogoOffers().then(offers => {
        setOfflineOffers(offers);
      });
    }
  }, [isOffline]);

  return {
    offers: isOffline ? offlineOffers : (onlineOffers || []),
    isLoading: isOffline ? false : isLoading,
    isOffline,
  };
};

export const useOfflineAnnouncements = () => {
  const [offlineAnnouncements, setOfflineAnnouncements] = useState<any[]>([]);
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

  const { data: onlineAnnouncements, isLoading } = useQuery({
    queryKey: ['announcements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;

      if (data) {
        await offlineDB.saveAnnouncements(data);
      }

      return data || [];
    },
    enabled: !isOffline,
  });

  useEffect(() => {
    if (isOffline) {
      offlineDB.getAnnouncements().then(announcements => {
        setOfflineAnnouncements(announcements);
      });
    }
  }, [isOffline]);

  return {
    announcements: isOffline ? offlineAnnouncements : (onlineAnnouncements || []),
    isLoading: isOffline ? false : isLoading,
    isOffline,
  };
};

export const useOfflineCustomPriceTiers = () => {
  const [offlineTiers, setOfflineTiers] = useState<any[]>([]);
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

  const { data: onlineTiers, isLoading } = useQuery({
    queryKey: ['custom-price-tiers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('custom_price_tiers')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;

      if (data) {
        await offlineDB.saveCustomPriceTiers(data);
      }

      return data || [];
    },
    enabled: !isOffline,
  });

  useEffect(() => {
    if (isOffline) {
      offlineDB.getCustomPriceTiers().then(tiers => {
        setOfflineTiers(tiers);
      });
    }
  }, [isOffline]);

  return {
    tiers: isOffline ? offlineTiers : (onlineTiers || []),
    isLoading: isOffline ? false : isLoading,
    isOffline,
  };
};

export const useOfflineCustomTierPrices = () => {
  const [offlinePrices, setOfflinePrices] = useState<any[]>([]);
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

  const { data: onlinePrices, isLoading } = useQuery({
    queryKey: ['custom-tier-prices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('custom_tier_prices')
        .select('*');

      if (error) throw error;

      if (data) {
        await offlineDB.saveCustomTierPrices(data);
      }

      return data || [];
    },
    enabled: !isOffline,
  });

  useEffect(() => {
    if (isOffline) {
      offlineDB.getCustomTierPrices().then(prices => {
        setOfflinePrices(prices);
      });
    }
  }, [isOffline]);

  return {
    prices: isOffline ? offlinePrices : (onlinePrices || []),
    isLoading: isOffline ? false : isLoading,
    isOffline,
  };
};

export const useOfflineCustomerProductPrices = () => {
  const [offlinePrices, setOfflinePrices] = useState<any[]>([]);
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

  const { data: onlinePrices, isLoading } = useQuery({
    queryKey: ['customer-product-prices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_product_prices')
        .select('*');

      if (error) throw error;

      if (data) {
        await offlineDB.saveCustomerProductPrices(data);
      }

      return data || [];
    },
    enabled: !isOffline,
  });

  useEffect(() => {
    if (isOffline) {
      offlineDB.getCustomerProductPrices().then(prices => {
        setOfflinePrices(prices);
      });
    }
  }, [isOffline]);

  return {
    prices: isOffline ? offlinePrices : (onlinePrices || []),
    isLoading: isOffline ? false : isLoading,
    isOffline,
  };
};
