import { useRef, useCallback } from 'react';

interface CachedProduct {
  barcode: string;
  type: 'variant' | 'product';
  data: any;
  timestamp: number;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 100;

/**
 * In-memory barcode cache for fast product lookup
 * Eliminates database queries for frequently scanned products
 */
export const useBarcodeCache = () => {
  const cacheRef = useRef<Map<string, CachedProduct>>(new Map());

  const get = useCallback((barcode: string): CachedProduct | null => {
    const cached = cacheRef.current.get(barcode);
    if (!cached) return null;
    
    // Check if expired
    if (Date.now() - cached.timestamp > CACHE_TTL) {
      cacheRef.current.delete(barcode);
      return null;
    }
    
    return cached;
  }, []);

  const set = useCallback((barcode: string, type: 'variant' | 'product', data: any) => {
    // Limit cache size - remove oldest entries if needed
    if (cacheRef.current.size >= MAX_CACHE_SIZE) {
      const oldestKey = cacheRef.current.keys().next().value;
      if (oldestKey) cacheRef.current.delete(oldestKey);
    }
    
    cacheRef.current.set(barcode, {
      barcode,
      type,
      data,
      timestamp: Date.now(),
    });
  }, []);

  const clear = useCallback(() => {
    cacheRef.current.clear();
  }, []);

  return { get, set, clear };
};

// Global singleton cache for use outside React components
class BarcodeCache {
  private cache = new Map<string, CachedProduct>();

  get(barcode: string): CachedProduct | null {
    const cached = this.cache.get(barcode);
    if (!cached) return null;
    
    if (Date.now() - cached.timestamp > CACHE_TTL) {
      this.cache.delete(barcode);
      return null;
    }
    
    return cached;
  }

  set(barcode: string, type: 'variant' | 'product', data: any) {
    if (this.cache.size >= MAX_CACHE_SIZE) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }
    
    this.cache.set(barcode, {
      barcode,
      type,
      data,
      timestamp: Date.now(),
    });
  }

  clear() {
    this.cache.clear();
  }
}

export const barcodeCache = new BarcodeCache();
