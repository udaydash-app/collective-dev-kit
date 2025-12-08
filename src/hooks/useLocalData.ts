/**
 * Hook for accessing data with automatic offline/local mode fallback to IndexedDB
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { offlineDB } from '@/lib/offlineDB';
import { shouldUseLocalData } from '@/lib/localModeHelper';
import { useState, useEffect } from 'react';

// Track if we're in local mode (cached for performance)
export const useIsLocalMode = () => {
  const [isLocal, setIsLocal] = useState(shouldUseLocalData());
  
  useEffect(() => {
    const handleOnline = () => setIsLocal(shouldUseLocalData());
    const handleOffline = () => setIsLocal(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  return isLocal;
};

// Generic hook for fetching data with local fallback
export const useLocalQuery = <T>(
  queryKey: string[],
  supabaseFetcher: () => Promise<T[]>,
  indexedDBFetcher: () => Promise<T[]>,
  options?: { enabled?: boolean }
) => {
  const isLocal = useIsLocalMode();
  
  return useQuery({
    queryKey: [...queryKey, isLocal],
    queryFn: async () => {
      if (isLocal) {
        try {
          const data = await indexedDBFetcher();
          console.log(`[LocalQuery] ${queryKey[0]}: loaded ${data.length} items from IndexedDB`);
          return data;
        } catch (e) {
          console.error(`[LocalQuery] ${queryKey[0]}: IndexedDB error`, e);
          return [];
        }
      }
      
      try {
        const data = await supabaseFetcher();
        return data;
      } catch (e) {
        console.error(`[LocalQuery] ${queryKey[0]}: Supabase error, falling back to IndexedDB`, e);
        return indexedDBFetcher();
      }
    },
    enabled: options?.enabled !== false,
    staleTime: isLocal ? Infinity : 5 * 60 * 1000, // No refetch in local mode
  });
};

// Pre-built hooks for common data types
export const useLocalStores = () => {
  return useLocalQuery(
    ['stores'],
    async () => {
      const { data } = await supabase
        .from('stores')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      return data || [];
    },
    () => offlineDB.getStores()
  );
};

export const useLocalAccounts = () => {
  return useLocalQuery(
    ['accounts'],
    async () => {
      const { data } = await supabase
        .from('accounts')
        .select('*')
        .eq('is_active', true)
        .order('account_code');
      return data || [];
    },
    () => offlineDB.getAccounts()
  );
};

export const useLocalContacts = (filters?: { isCustomer?: boolean; isSupplier?: boolean }) => {
  return useLocalQuery(
    ['contacts', JSON.stringify(filters)],
    async () => {
      let query = supabase.from('contacts').select('*');
      if (filters?.isCustomer !== undefined) {
        query = query.eq('is_customer', filters.isCustomer);
      }
      if (filters?.isSupplier !== undefined) {
        query = query.eq('is_supplier', filters.isSupplier);
      }
      const { data } = await query.order('name');
      return data || [];
    },
    async () => {
      const contacts = await offlineDB.getContacts();
      let filtered = contacts;
      if (filters?.isCustomer !== undefined) {
        filtered = filtered.filter(c => c.is_customer === filters.isCustomer);
      }
      if (filters?.isSupplier !== undefined) {
        filtered = filtered.filter(c => c.is_supplier === filters.isSupplier);
      }
      return filtered;
    }
  );
};

export const useLocalProducts = (storeId?: string) => {
  return useLocalQuery<any>(
    ['products', storeId || 'all'],
    async () => {
      let query = supabase
        .from('products')
        .select('*, product_variants(*)')
        .eq('is_available', true);
      if (storeId) {
        query = query.eq('store_id', storeId);
      }
      const { data } = await query;
      return data || [];
    },
    async () => {
      const products = await offlineDB.getProducts();
      if (storeId) {
        return products.filter((p: any) => p.store_id === storeId);
      }
      return products;
    }
  );
};

export const useLocalCashSessions = (storeId?: string, cashierId?: string) => {
  return useLocalQuery(
    ['cash-sessions', storeId || 'all', cashierId || 'all'],
    async () => {
      let query = supabase.from('cash_sessions').select('*');
      if (storeId) query = query.eq('store_id', storeId);
      if (cashierId) query = query.eq('cashier_id', cashierId);
      const { data } = await query.order('opened_at', { ascending: false });
      return data || [];
    },
    async () => {
      const sessions = await offlineDB.getCashSessions();
      let filtered = sessions;
      if (storeId) filtered = filtered.filter(s => s.store_id === storeId);
      if (cashierId) filtered = filtered.filter(s => s.cashier_id === cashierId);
      return filtered.sort((a, b) => new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime());
    }
  );
};

export const useLocalJournalEntries = () => {
  return useLocalQuery(
    ['journal-entries'],
    async () => {
      const { data } = await supabase
        .from('journal_entries')
        .select('*')
        .order('entry_date', { ascending: false });
      return data || [];
    },
    () => offlineDB.getJournalEntries()
  );
};

export const useLocalPurchases = () => {
  return useLocalQuery(
    ['purchases'],
    async () => {
      const { data } = await supabase
        .from('purchases')
        .select('*')
        .order('purchased_at', { ascending: false });
      return data || [];
    },
    () => offlineDB.getPurchases()
  );
};

export const useLocalExpenses = () => {
  return useLocalQuery(
    ['expenses'],
    async () => {
      const { data } = await supabase
        .from('expenses')
        .select('*')
        .order('expense_date', { ascending: false });
      return data || [];
    },
    () => offlineDB.getExpenses()
  );
};

export const useLocalPOSTransactions = (storeId?: string) => {
  return useLocalQuery(
    ['pos-transactions', storeId || 'all'],
    async () => {
      let query = supabase.from('pos_transactions').select('*');
      if (storeId) query = query.eq('store_id', storeId);
      const { data } = await query.order('created_at', { ascending: false });
      return data || [];
    },
    async () => {
      const transactions = await offlineDB.getPOSTransactions();
      if (storeId) return transactions.filter(t => t.store_id === storeId);
      return transactions;
    }
  );
};
