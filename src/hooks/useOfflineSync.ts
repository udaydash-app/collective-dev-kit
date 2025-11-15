/**
 * React hook for managing offline/online status and automatic syncing
 */

import { useState, useEffect } from 'react';
import { syncService } from '@/lib/syncService';
import { offlineDB } from '@/lib/offlineDB';
import { toast } from 'sonner';

export const useOfflineSync = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [unsyncedCount, setUnsyncedCount] = useState(0);

  // Update online status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('Connection restored');
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.warning('Working offline - transactions will sync when connection is restored');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Check unsynced count periodically
  useEffect(() => {
    const checkUnsyncedCount = async () => {
      try {
        const transactions = await offlineDB.getUnsyncedTransactions();
        setUnsyncedCount(transactions.length);
      } catch (error) {
        console.error('Error checking unsynced count:', error);
      }
    };

    checkUnsyncedCount();
    const interval = setInterval(checkUnsyncedCount, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, []);

  // Start auto-sync on mount and cache data when coming online
  useEffect(() => {
    syncService.startAutoSync(30000); // Sync every 30 seconds

    // Cache data when coming online
    const handleOnlineSync = async () => {
      if (navigator.onLine) {
        try {
          const { cacheEssentialData, isCacheStale } = await import('@/lib/cacheData');
          // Refresh cache if stale (older than 24 hours)
          if (isCacheStale(24)) {
            console.log('Cache is stale, refreshing...');
            await cacheEssentialData(false);
          }
        } catch (error) {
          console.error('Error refreshing cache:', error);
        }
      }
    };

    window.addEventListener('online', handleOnlineSync);

    return () => {
      syncService.stopAutoSync();
      window.removeEventListener('online', handleOnlineSync);
    };
  }, []);

  // Manual sync function
  const manualSync = async () => {
    if (!isOnline) {
      toast.error('Cannot sync while offline');
      return;
    }

    setIsSyncing(true);
    try {
      await syncService.syncTransactions();
      // Update unsynced count after sync
      const transactions = await offlineDB.getUnsyncedTransactions();
      setUnsyncedCount(transactions.length);
    } catch (error) {
      console.error('Manual sync failed:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  return {
    isOnline,
    isSyncing,
    unsyncedCount,
    manualSync,
  };
};
