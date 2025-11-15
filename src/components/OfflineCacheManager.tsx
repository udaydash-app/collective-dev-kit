/**
 * Component to manage offline data caching
 * Shows cache status and allows manual refresh
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { RefreshCw, Database, CheckCircle, AlertCircle } from 'lucide-react';
import { cacheEssentialData, getLastCacheTime, isCacheStale } from '@/lib/cacheData';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

export const OfflineCacheManager = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isCaching, setIsCaching] = useState(false);
  const [lastCacheTime, setLastCacheTime] = useState<Date | null>(null);
  const [cacheStale, setCacheStale] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check cache status
    const checkCacheStatus = () => {
      const lastCache = getLastCacheTime();
      setLastCacheTime(lastCache);
      setCacheStale(isCacheStale(24));
    };

    checkCacheStatus();
    const interval = setInterval(checkCacheStatus, 60000); // Check every minute

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  const handleCacheData = async () => {
    if (!isOnline) {
      toast.error('Cannot cache data while offline');
      return;
    }

    setIsCaching(true);
    try {
      await cacheEssentialData(true);
      const newLastCache = getLastCacheTime();
      setLastCacheTime(newLastCache);
      setCacheStale(false);
    } catch (error) {
      console.error('Failed to cache data:', error);
      toast.error('Failed to cache data');
    } finally {
      setIsCaching(false);
    }
  };

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Offline Data Cache</h3>
        </div>
        {lastCacheTime && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {cacheStale ? (
              <>
                <AlertCircle className="h-4 w-4 text-yellow-500" />
                <span>Cache is stale</span>
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>Cache is fresh</span>
              </>
            )}
          </div>
        )}
      </div>

      <div className="space-y-2 text-sm text-muted-foreground">
        {lastCacheTime ? (
          <p>
            Last cached: {formatDistanceToNow(lastCacheTime, { addSuffix: true })}
          </p>
        ) : (
          <p>No cached data yet. Cache data to enable offline operation.</p>
        )}
        <p>
          Status: <span className={isOnline ? 'text-green-500' : 'text-red-500'}>
            {isOnline ? 'Online' : 'Offline'}
          </span>
        </p>
      </div>

      <Button
        onClick={handleCacheData}
        disabled={!isOnline || isCaching}
        className="w-full"
        variant={cacheStale ? 'default' : 'outline'}
      >
        <RefreshCw className={`mr-2 h-4 w-4 ${isCaching ? 'animate-spin' : ''}`} />
        {isCaching ? 'Caching Data...' : cacheStale ? 'Refresh Cache' : 'Update Cache'}
      </Button>

      <div className="text-xs text-muted-foreground">
        <p>Cache includes: Products, Categories, Stores, Customers, POS Users, and Combo Offers</p>
      </div>
    </Card>
  );
};
