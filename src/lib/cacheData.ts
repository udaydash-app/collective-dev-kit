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

    // Fetch and cache BOGO offers
    if (showProgress) toast.loading('Caching BOGO offers...');
    const bogoOffersQuery = supabase
      .from('bogo_offers')
      .select('*')
      .eq('is_active', true);
    
    const bogoOffersResult: any = await bogoOffersQuery;
    const bogoOffers = bogoOffersResult.data;

    if (bogoOffers && Array.isArray(bogoOffers)) {
      await offlineDB.saveBogoOffers(bogoOffers);
      console.log(`Cached ${bogoOffers.length} BOGO offers`);
    }

    // Fetch and cache multi-product BOGO offers
    if (showProgress) toast.loading('Caching multi-product BOGO offers...');
    const multiBogoOffersQuery = supabase
      .from('multi_product_bogo_offers')
      .select('*')
      .eq('is_active', true);
    
    const multiBogoOffersResult: any = await multiBogoOffersQuery;
    const multiBogoOffers = multiBogoOffersResult.data;

    if (multiBogoOffers && Array.isArray(multiBogoOffers)) {
      await offlineDB.saveMultiProductBogoOffers(multiBogoOffers);
      console.log(`Cached ${multiBogoOffers.length} multi-product BOGO offers`);

      // Fetch and cache multi-product BOGO items
      const multiBogoItemsQuery = supabase
        .from('multi_product_bogo_items')
        .select('*');
      
      const multiBogoItemsResult: any = await multiBogoItemsQuery;
      const multiBogoItems = multiBogoItemsResult.data;

      if (multiBogoItems && Array.isArray(multiBogoItems)) {
        await offlineDB.saveMultiProductBogoItems(multiBogoItems);
        console.log(`Cached ${multiBogoItems.length} multi-product BOGO items`);
      }
    }

    // Fetch and cache announcements
    if (showProgress) toast.loading('Caching announcements...');
    const announcementsQuery = supabase
      .from('announcements')
      .select('*')
      .eq('is_active', true);
    
    const announcementsResult: any = await announcementsQuery;
    const announcements = announcementsResult.data;

    if (announcements && Array.isArray(announcements)) {
      await offlineDB.saveAnnouncements(announcements);
      console.log(`Cached ${announcements.length} announcements`);
    }

    // Fetch and cache custom price tiers
    if (showProgress) toast.loading('Caching custom price tiers...');
    const customTiersQuery = supabase
      .from('custom_price_tiers')
      .select('*')
      .eq('is_active', true);
    
    const customTiersResult: any = await customTiersQuery;
    const customTiers = customTiersResult.data;

    if (customTiers && Array.isArray(customTiers)) {
      await offlineDB.saveCustomPriceTiers(customTiers);
      console.log(`Cached ${customTiers.length} custom price tiers`);
    }

    // Fetch and cache custom tier prices
    if (showProgress) toast.loading('Caching custom tier prices...');
    const customTierPricesQuery = supabase
      .from('custom_tier_prices')
      .select('*');
    
    const customTierPricesResult: any = await customTierPricesQuery;
    const customTierPrices = customTierPricesResult.data;

    if (customTierPrices && Array.isArray(customTierPrices)) {
      await offlineDB.saveCustomTierPrices(customTierPrices);
      console.log(`Cached ${customTierPrices.length} custom tier prices`);
    }

    // Fetch and cache customer product prices
    if (showProgress) toast.loading('Caching customer product prices...');
    const customerPricesQuery = supabase
      .from('customer_product_prices')
      .select('*');
    
    const customerPricesResult: any = await customerPricesQuery;
    const customerPrices = customerPricesResult.data;

    if (customerPrices && Array.isArray(customerPrices)) {
      await offlineDB.saveCustomerProductPrices(customerPrices);
      console.log(`Cached ${customerPrices.length} customer product prices`);
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
