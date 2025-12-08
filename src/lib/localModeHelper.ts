/**
 * Helper to detect connectivity and local Supabase configuration
 * 
 * Key distinction:
 * - Local Supabase (LAN) = Supabase running on Docker locally, queries go to local DB (fast!)
 * - Offline = No network, use IndexedDB cache
 * - Cloud = Normal cloud Supabase queries
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
 * In this case, we must use IndexedDB cache
 */
export const isOffline = (): boolean => {
  return !navigator.onLine;
};

/**
 * Returns true if we should use IndexedDB instead of Supabase queries
 * This is ONLY when truly offline (no network connection)
 * 
 * When using local Supabase on LAN, queries should go to local Supabase (fast!)
 */
export const shouldUseLocalData = (): boolean => {
  // Only use IndexedDB when truly offline
  return !navigator.onLine;
};

// Reset cache (call when config changes)
export const resetLocalModeCache = () => {
  cachedIsLocalSupabase = null;
};
