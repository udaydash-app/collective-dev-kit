/**
 * Hook for accessing data with automatic offline fallback to IndexedDB
 * 
 * Key logic:
 * - Online (cloud or local Supabase) → Query Supabase directly
 * - Offline (no network) → Use IndexedDB cache
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { offlineDB } from '@/lib/offlineDB';
import { isOffline, isLocalSupabase } from '@/lib/localModeHelper';
import { useState, useEffect } from 'react';

// Track online/offline state
export const useIsOffline = () => {
  const [offline, setOffline] = useState(!navigator.onLine);
  
  useEffect(() => {
    const handleOnline = () => setOffline(false);
    const handleOffline = () => setOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  return offline;
};

// Keep for backward compatibility
export const useIsLocalMode = () => {
  return useIsOffline();
};

// Generic hook for fetching data with offline fallback
export const useLocalQuery = <T>(
  queryKey: string[],
  supabaseFetcher: () => Promise<T[]>,
  indexedDBFetcher: () => Promise<T[]>,
  options?: { enabled?: boolean }
) => {
  const offline = useIsOffline();
  
  return useQuery({
    queryKey: [...queryKey, offline ? 'offline' : 'online'],
    queryFn: async () => {
      // Only use IndexedDB when truly offline
      if (offline) {
        try {
          const data = await indexedDBFetcher();
          console.log(`[Offline] ${queryKey[0]}: loaded ${data.length} items from IndexedDB`);
          return data;
        } catch (e) {
          console.error(`[Offline] ${queryKey[0]}: IndexedDB error`, e);
          return [];
        }
      }
      
      // Online - query Supabase (local or cloud)
      try {
        const data = await supabaseFetcher();
        if (isLocalSupabase()) {
          console.log(`[Local Supabase] ${queryKey[0]}: loaded ${(data || []).length} items`);
        }
        return data;
      } catch (e) {
        console.error(`[Supabase Error] ${queryKey[0]}: falling back to IndexedDB`, e);
        return indexedDBFetcher();
      }
    },
    enabled: options?.enabled !== false,
    staleTime: offline ? Infinity : 30 * 1000, // 30 seconds for online
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: !offline,
    refetchOnMount: !offline,
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

export const useLocalCategories = () => {
  return useLocalQuery(
    ['categories'],
    async () => {
      const { data } = await supabase
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .order('display_order');
      return data || [];
    },
    () => offlineDB.getCategories()
  );
};

export const useLocalBogoOffers = () => {
  return useLocalQuery(
    ['bogo-offers'],
    async () => {
      const { data } = await supabase
        .from('bogo_offers')
        .select('*')
        .eq('is_active', true);
      return data || [];
    },
    () => offlineDB.getBogoOffers()
  );
};

export const useLocalMultiBogoOffers = () => {
  return useLocalQuery(
    ['multi-bogo-offers'],
    async () => {
      const { data } = await supabase
        .from('multi_product_bogo_offers')
        .select('*')
        .eq('is_active', true);
      return data || [];
    },
    () => offlineDB.getMultiProductBogoOffers()
  );
};

export const useLocalComboOffers = () => {
  return useLocalQuery(
    ['combo-offers'],
    async () => {
      const { data } = await supabase
        .from('combo_offers')
        .select('*, combo_offer_items(*)')
        .eq('is_active', true);
      return data || [];
    },
    () => offlineDB.getComboOffers()
  );
};

export const useLocalOrders = (status?: string) => {
  return useLocalQuery(
    ['orders', status || 'all'],
    async () => {
      let query = supabase.from('orders').select('*');
      if (status) query = query.eq('status', status);
      const { data } = await query.order('created_at', { ascending: false });
      return data || [];
    },
    async () => {
      const orders = await offlineDB.getOrders();
      if (status) return orders.filter(o => o.status === status);
      return orders;
    }
  );
};

export const useLocalSupplierPayments = () => {
  return useLocalQuery(
    ['supplier-payments'],
    async () => {
      const { data } = await supabase
        .from('supplier_payments')
        .select('*')
        .order('payment_date', { ascending: false });
      return data || [];
    },
    () => offlineDB.getSupplierPayments()
  );
};

export const useLocalPaymentReceipts = () => {
  return useLocalQuery(
    ['payment-receipts'],
    async () => {
      const { data } = await supabase
        .from('payment_receipts')
        .select('*')
        .order('payment_date', { ascending: false });
      return data || [];
    },
    () => offlineDB.getPaymentReceipts()
  );
};

export const useLocalJournalEntryLines = (journalEntryId?: string) => {
  return useLocalQuery(
    ['journal-entry-lines', journalEntryId || 'all'],
    async () => {
      let query = supabase.from('journal_entry_lines').select('*');
      if (journalEntryId) query = query.eq('journal_entry_id', journalEntryId);
      const { data } = await query;
      return data || [];
    },
    async () => {
      const lines = await offlineDB.getJournalEntryLines();
      if (journalEntryId) return lines.filter(l => l.journal_entry_id === journalEntryId);
      return lines;
    }
  );
};

export const useLocalPurchaseItems = (purchaseId?: string) => {
  return useLocalQuery(
    ['purchase-items', purchaseId || 'all'],
    async () => {
      let query = supabase.from('purchase_items').select('*');
      if (purchaseId) query = query.eq('purchase_id', purchaseId);
      const { data } = await query;
      return data || [];
    },
    async () => {
      const items = await offlineDB.getPurchaseItems();
      if (purchaseId) return items.filter(i => i.purchase_id === purchaseId);
      return items;
    }
  );
};
