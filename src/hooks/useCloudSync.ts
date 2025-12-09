/**
 * Hook to manage cloud sync - syncs local Supabase data to cloud when internet is available
 */

import { useEffect, useState } from 'react';
import { cloudSyncService } from '@/lib/cloudSyncService';
import { isLocalSupabase } from '@/lib/localModeHelper';

export const useCloudSync = () => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  useEffect(() => {
    // Only start cloud sync if we're using local Supabase
    if (!isLocalSupabase()) {
      console.log('[CloudSync] Not using local Supabase, skipping cloud sync setup');
      return;
    }

    console.log('[CloudSync] Local Supabase detected, starting cloud sync service...');
    
    // Start auto-sync every 5 minutes
    cloudSyncService.startAutoSync(300000);

    // Update status periodically
    const statusInterval = setInterval(() => {
      const status = cloudSyncService.getStatus();
      setIsSyncing(status.isSyncing);
      setLastSyncTime(status.lastSyncTime);
    }, 5000);

    return () => {
      cloudSyncService.stopAutoSync();
      clearInterval(statusInterval);
    };
  }, []);

  const manualSync = async () => {
    setIsSyncing(true);
    try {
      await cloudSyncService.syncToCloud();
    } finally {
      const status = cloudSyncService.getStatus();
      setIsSyncing(status.isSyncing);
      setLastSyncTime(status.lastSyncTime);
    }
  };

  const forceFullSync = async () => {
    setIsSyncing(true);
    try {
      await cloudSyncService.forceFullSync();
    } finally {
      const status = cloudSyncService.getStatus();
      setIsSyncing(status.isSyncing);
      setLastSyncTime(status.lastSyncTime);
    }
  };

  return {
    isSyncing,
    lastSyncTime,
    manualSync,
    forceFullSync
  };
};
