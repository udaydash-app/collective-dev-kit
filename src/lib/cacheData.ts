// @ts-nocheck
/**
 * Utility to cache essential data for offline use
 */

import { supabase } from '@/integrations/supabase/client';
import { offlineDB } from './offlineDB';

export async function cacheEssentialData() {
  try {
    // Fetch and cache products
    const productsQuery = supabase
      .from('products')
      .select('*')
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
    const storesQuery = supabase
      .from('stores')
      .select('*');
    
    const storesResult: any = await storesQuery;
    const stores = storesResult.data;

    if (stores && Array.isArray(stores)) {
      await offlineDB.saveStores(stores);
      console.log(`Cached ${stores.length} stores`);
    }

    // Fetch and cache categories
    const categoriesQuery = supabase
      .from('categories')
      .select('*');
    
    const categoriesResult: any = await categoriesQuery;
    const categories = categoriesResult.data;

    if (categories && Array.isArray(categories)) {
      await offlineDB.saveCategories(categories);
      console.log(`Cached ${categories.length} categories`);
    }

    return true;
  } catch (error) {
    console.error('Error caching data:', error);
    throw error;
  }
}
