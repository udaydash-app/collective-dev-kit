/**
 * Helper to detect if the app is running in local mode (local Supabase via LAN)
 * In local mode, we prioritize IndexedDB for faster reads
 */

import { getLocalSupabaseConfigStatus } from '@/integrations/supabase/client';

// Cache the result to avoid localStorage reads on every call
let cachedIsLocalMode: boolean | null = null;

export const isLocalMode = (): boolean => {
  if (cachedIsLocalMode !== null) return cachedIsLocalMode;
  
  const localConfig = getLocalSupabaseConfigStatus();
  cachedIsLocalMode = !!localConfig;
  return cachedIsLocalMode;
};

// Use this for combined offline/local mode check
export const shouldUseLocalData = (): boolean => {
  return !navigator.onLine || isLocalMode();
};

// Reset cache (call when config changes)
export const resetLocalModeCache = () => {
  cachedIsLocalMode = null;
};
