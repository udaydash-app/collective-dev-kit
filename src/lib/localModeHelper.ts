/**
 * Helper to detect connectivity and local Supabase configuration
 * 
 * Key distinction:
 * - Local Supabase (LAN) = Supabase running on Docker locally, queries go to local DB
 * - Offline = No network at all, use IndexedDB cache
 * - Cloud = Normal cloud Supabase queries
 * 
 * CRITICAL: When local Supabase is configured:
 * - Check if it's actually reachable before trying to query
 * - Use IndexedDB as a fallback if local Supabase is not responding
 * - navigator.onLine is unreliable for LAN-only setups
 */

import { getLocalSupabaseConfigStatus } from '@/integrations/supabase/client';

// Cache the result to avoid localStorage reads on every call
let cachedIsLocalSupabase: boolean | null = null;
let cachedLocalSupabaseReachable: boolean | null = null;
let lastReachabilityCheck = 0;
const REACHABILITY_CHECK_INTERVAL = 30000; // Check every 30 seconds

// Check if using local Supabase (Docker on LAN)
const checkIsLocalSupabase = (): boolean => {
  // Check localStorage for local config first
  const localConfig = getLocalSupabaseConfigStatus();
  if (localConfig) return true;
  
  // Also check if the current Supabase URL is HTTP (local)
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
    if (supabaseUrl.startsWith('http://')) return true;
  } catch (e) {
    // ignore
  }
  
  return false;
};

/**
 * Returns true if using local Supabase (Docker on LAN)
 * This means queries go to local Supabase, not cloud
 */
export const isLocalSupabase = (): boolean => {
  if (cachedIsLocalSupabase !== null) return cachedIsLocalSupabase;
  cachedIsLocalSupabase = checkIsLocalSupabase();
  return cachedIsLocalSupabase;
};

/**
 * Check if local Supabase is actually reachable with a quick timeout
 * This is called periodically to update the cached reachability status
 */
export const checkLocalSupabaseReachable = async (): Promise<boolean> => {
  const localConfig = getLocalSupabaseConfigStatus();
  if (!localConfig?.url) return false;
  
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000); // 3 second timeout
    
    // Just check if the URL is reachable - we don't need to include apikey for HEAD request
    const response = await fetch(`${localConfig.url}/rest/v1/`, {
      method: 'HEAD',
      signal: controller.signal,
    });
    
    clearTimeout(timeout);
    cachedLocalSupabaseReachable = response.ok || response.status === 400 || response.status === 401; // 400/401 is OK (means server is responding)
    lastReachabilityCheck = Date.now();
    console.log('[LocalMode] Local Supabase reachable:', cachedLocalSupabaseReachable);
    return cachedLocalSupabaseReachable;
  } catch (e) {
    console.log('[LocalMode] Local Supabase not reachable:', e);
    cachedLocalSupabaseReachable = false;
    lastReachabilityCheck = Date.now();
    return false;
  }
};

/**
 * Returns cached reachability status, triggering a background check if stale
 */
export const isLocalSupabaseReachable = (): boolean => {
  // If not configured as local, return false
  if (!isLocalSupabase()) return false;
  
  // If we've never checked or check is stale, trigger background check
  if (cachedLocalSupabaseReachable === null || 
      Date.now() - lastReachabilityCheck > REACHABILITY_CHECK_INTERVAL) {
    // Trigger async check but return current cached value
    checkLocalSupabaseReachable();
  }
  
  // Return cached value (optimistic: true if never checked)
  return cachedLocalSupabaseReachable ?? true;
};

/**
 * DEPRECATED - use isOffline() or isLocalSupabase() instead
 * Kept for backward compatibility
 */
export const isLocalMode = (): boolean => {
  return isLocalSupabase();
};

/**
 * Returns true ONLY if browser is actually offline (no network)
 * NOTE: This is unreliable for LAN-only setups where navigator.onLine may be false
 * even though local Supabase is reachable
 */
export const isOffline = (): boolean => {
  return !navigator.onLine;
};

/**
 * Returns true if we should SKIP Supabase and use IndexedDB directly
 * 
 * Use IndexedDB directly when:
 * 1. Browser is truly offline AND we're using cloud Supabase (not local)
 * 2. Local Supabase is configured but NOT reachable
 */
export const shouldUseLocalData = (): boolean => {
  // If local Supabase is configured AND reachable, don't use IndexedDB
  if (isLocalSupabase() && isLocalSupabaseReachable()) {
    return false;
  }
  
  // If local Supabase is configured but NOT reachable, use IndexedDB
  if (isLocalSupabase() && !isLocalSupabaseReachable()) {
    return true;
  }
  
  // For cloud Supabase, use IndexedDB only when truly offline
  return !navigator.onLine;
};

/**
 * Returns true if we should try Supabase queries (local or cloud)
 * This is the primary check - when true, query Supabase
 * When false (truly offline with cloud config, or local not reachable), use IndexedDB
 */
export const shouldQuerySupabase = (): boolean => {
  // If local Supabase is configured, check if it's reachable
  if (isLocalSupabase()) {
    return isLocalSupabaseReachable();
  }
  
  // For cloud, only query when online
  return navigator.onLine;
};

// Reset cache (call when config changes)
export const resetLocalModeCache = () => {
  cachedIsLocalSupabase = null;
  cachedLocalSupabaseReachable = null;
  lastReachabilityCheck = 0;
};

// Initialize reachability check on module load
if (typeof window !== 'undefined') {
  setTimeout(() => {
    if (isLocalSupabase()) {
      checkLocalSupabaseReachable();
    }
  }, 1000);
}
