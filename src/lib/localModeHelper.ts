/**
 * Helper to detect connectivity and local Supabase configuration
 * 
 * Key distinction:
 * - Local Supabase (LAN) = Supabase running on Docker locally, queries go to local DB
 * - Offline = No network at all, use IndexedDB cache
 * - Cloud = Normal cloud Supabase queries
 * 
 * CRITICAL: When local Supabase is configured:
 * - ALWAYS try to query local Supabase first (it's on LAN, should be fast)
 * - Only use IndexedDB as a fallback if the query fails
 * - navigator.onLine is unreliable for LAN-only setups
 */

import { getLocalSupabaseConfigStatus } from '@/integrations/supabase/client';

// Cache the result to avoid localStorage reads on every call
let cachedIsLocalSupabase: boolean | null = null;

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
 * IMPORTANT: When local Supabase is configured, we should ALWAYS try to query it first
 * because it's on the LAN and should be reachable. Only use IndexedDB as fallback.
 * 
 * Use IndexedDB directly ONLY when:
 * 1. Browser is truly offline AND we're using cloud Supabase (not local)
 * 
 * When local Supabase is configured:
 * - Always try Supabase first (it's on LAN)
 * - Fall back to IndexedDB only if query fails
 */
export const shouldUseLocalData = (): boolean => {
  // If local Supabase is configured, NEVER skip it - always try LAN first
  if (isLocalSupabase()) {
    return false; // Don't use IndexedDB, try local Supabase
  }
  
  // For cloud Supabase, use IndexedDB only when truly offline
  return !navigator.onLine;
};

/**
 * Returns true if we should try Supabase queries (local or cloud)
 * This is the primary check - when true, query Supabase
 * When false (truly offline with cloud config), use IndexedDB
 */
export const shouldQuerySupabase = (): boolean => {
  // If local Supabase is configured, always try to query it
  if (isLocalSupabase()) {
    return true;
  }
  
  // For cloud, only query when online
  return navigator.onLine;
};

// Reset cache (call when config changes)
export const resetLocalModeCache = () => {
  cachedIsLocalSupabase = null;
};
