/**
 * Helper to detect if the app is running in local mode (local Supabase via LAN)
 * In local mode, we prioritize IndexedDB for faster reads
 */

import { getLocalSupabaseConfigStatus } from '@/integrations/supabase/client';

// Cache the result to avoid localStorage reads on every call
let cachedIsLocalMode: boolean | null = null;

// Check if Supabase URL starts with http:// (local LAN) vs https:// (cloud)
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

export const isLocalMode = (): boolean => {
  if (cachedIsLocalMode !== null) return cachedIsLocalMode;
  
  cachedIsLocalMode = checkIsLocalSupabase();
  
  if (cachedIsLocalMode) {
    console.log('Local mode detected - using IndexedDB for data');
  }
  
  return cachedIsLocalMode;
};

// Use this for combined offline/local mode check
// Returns true if we should use IndexedDB instead of Supabase queries
export const shouldUseLocalData = (): boolean => {
  // Always use local data if browser is offline
  if (!navigator.onLine) return true;
  
  // Use local data if local Supabase config is set (LAN mode)
  return isLocalMode();
};

// Reset cache (call when config changes)
export const resetLocalModeCache = () => {
  cachedIsLocalMode = null;
};
