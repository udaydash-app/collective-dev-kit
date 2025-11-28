// @ts-nocheck
/**
 * Comprehensive data caching utility for offline operation
 * Caches all essential data needed for POS to work completely offline
 */

import { supabase } from '@/integrations/supabase/client';
import { offlineDB } from './offlineDB';
import { toast } from 'sonner';

export async function cacheEssentialData(showProgress = false) {
  try {
    if (showProgress) toast.info('Starting data cache...');
    
    // Fetch and cache products with variants
    if (showProgress) toast.loading('Caching products...');
    const productsQuery = supabase
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
      .eq('is_available', true);
    
    const productsResult: any = await productsQuery;
    const products = productsResult.data;

    if (products && Array.isArray(products)) {
      const offlineProducts = products.map((p: any) => ({
        ...p,
        lastUpdated: new Date().toISOString()
      }));
      await offlineDB.saveProducts(offlineProducts);
      console.log(`Cached ${products.length} products`);
    }

    // Fetch and cache stores
    if (showProgress) toast.loading('Caching stores...');
    const storesQuery = supabase
      .from('stores')
      .select('*')
      .eq('is_active', true);
    
    const storesResult: any = await storesQuery;
    const stores = storesResult.data;

    if (stores && Array.isArray(stores)) {
      await offlineDB.saveStores(stores);
      console.log(`Cached ${stores.length} stores`);
    }

    // Fetch and cache categories
    if (showProgress) toast.loading('Caching categories...');
    const categoriesQuery = supabase
      .from('categories')
      .select('*')
      .eq('is_active', true);
    
    const categoriesResult: any = await categoriesQuery;
    const categories = categoriesResult.data;

    if (categories && Array.isArray(categories)) {
      await offlineDB.saveCategories(categories);
      console.log(`Cached ${categories.length} categories`);
    }

    // Fetch and cache customers
    if (showProgress) toast.loading('Caching customers...');
    const customersQuery = supabase
      .from('contacts')
      .select('id, name, email, phone, type, credit_limit, outstanding_balance')
      .eq('type', 'customer');
    
    const customersResult: any = await customersQuery;
    const customers = customersResult.data;

    if (customers && Array.isArray(customers)) {
      await offlineDB.saveCustomers(customers);
      console.log(`Cached ${customers.length} customers`);
    }

    // Fetch and cache POS users
    if (showProgress) toast.loading('Caching POS users...');
    const posUsersQuery = supabase
      .from('pos_users')
      .select('id, name, pin, role, is_active')
      .eq('is_active', true);
    
    const posUsersResult: any = await posUsersQuery;
    const posUsers = posUsersResult.data;

    if (posUsers && Array.isArray(posUsers)) {
      await offlineDB.savePOSUsers(posUsers);
      console.log(`Cached ${posUsers.length} POS users`);
    }

    // Fetch and cache combo offers
    if (showProgress) toast.loading('Caching combo offers...');
    const comboOffersQuery = supabase
      .from('combo_offers')
      .select('*')
      .eq('is_active', true);
    
    const comboOffersResult: any = await comboOffersQuery;
    const comboOffers = comboOffersResult.data;

    if (comboOffers && Array.isArray(comboOffers)) {
      await offlineDB.saveComboOffers(comboOffers);
      console.log(`Cached ${comboOffers.length} combo offers`);
      
      // Cache combo offer items for each offer
      for (const offer of comboOffers) {
        const itemsQuery = supabase
          .from('combo_offer_items')
          .select('*')
          .eq('combo_offer_id', offer.id);
        
        const itemsResult: any = await itemsQuery;
        const items = itemsResult.data;
        
        if (items && Array.isArray(items)) {
          await offlineDB.saveComboOfferItems(offer.id, items);
        }
      }
    }

    // Fetch and cache accounts
    if (showProgress) toast.loading('Caching accounts...');
    const accountsQuery = supabase
      .from('accounts')
      .select('*')
      .eq('is_active', true);
    
    const accountsResult: any = await accountsQuery;
    const accounts = accountsResult.data;

    if (accounts && Array.isArray(accounts)) {
      await offlineDB.saveAccounts(accounts);
      console.log(`Cached ${accounts.length} accounts`);
    }

    // Store last cache timestamp
    localStorage.setItem('lastCacheTime', new Date().toISOString());
    
    if (showProgress) toast.success('All data cached successfully for offline use');
    console.log('Full data cache completed successfully');
    
    return true;
  } catch (error) {
    console.error('Error caching data:', error);
    if (showProgress) toast.error('Failed to cache data');
    throw error;
  }
}

export function getLastCacheTime(): Date | null {
  const lastCache = localStorage.getItem('lastCacheTime');
  return lastCache ? new Date(lastCache) : null;
}

export function isCacheStale(hours = 24): boolean {
  const lastCache = getLastCacheTime();
  if (!lastCache) return true;
  
  const hoursSinceCache = (Date.now() - lastCache.getTime()) / (1000 * 60 * 60);
  return hoursSinceCache > hours;
}
