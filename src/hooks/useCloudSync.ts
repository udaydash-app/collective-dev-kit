/**
 * Hook to manage cloud sync - syncs local Supabase data to cloud when internet is available
 */

import { useEffect, useState } from 'react';
import { cloudSyncService } from '@/lib/cloudSyncService';
import { isLocalSupabase } from '@/lib/localModeHelper';
import { isElectronLocalDb } from '@/integrations/db/localSql';

export const useCloudSync = () => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  useEffect(() => {
    // Start cloud sync for LAN local Supabase and Windows embedded local DB.
    if (!isLocalSupabase() && !isElectronLocalDb()) {
      console.log('[CloudSync] No local database mode detected, skipping cloud sync setup');
      return;
    }

    console.log('[CloudSync] Local database detected, cloud sync will run when internet is available');
    
    // Start auto-sync every 5 minutes (service checks internet availability internally)
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
