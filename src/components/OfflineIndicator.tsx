/**
 * Component to show offline/online status and sync status
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { Wifi, WifiOff, RefreshCw, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export const OfflineIndicator = () => {
  const { isOnline, isSyncing, unsyncedCount, manualSync } = useOfflineSync();

  if (isOnline && unsyncedCount === 0 && !isSyncing) {
    return null; // Don't show anything when online and everything is synced
  }

  return (
    <div className="fixed bottom-20 right-4 z-50 flex flex-col gap-2">
      {/* Online/Offline Status */}
      <Badge
        variant={isOnline ? "default" : "destructive"}
        className={cn(
          "flex items-center gap-2 px-3 py-2 shadow-lg",
          isOnline ? "bg-green-600" : "bg-amber-600"
        )}
      >
        {isOnline ? (
          <>
            <Wifi className="h-4 w-4" />
            Online
          </>
        ) : (
          <>
            <WifiOff className="h-4 w-4" />
            Offline
          </>
        )}
      </Badge>

      {/* Unsynced Transactions */}
      {unsyncedCount > 0 && (
        <Badge
          variant="secondary"
          className="flex items-center gap-2 px-3 py-2 shadow-lg bg-blue-600 text-white"
        >
          <AlertCircle className="h-4 w-4" />
          {unsyncedCount} pending sync
        </Badge>
      )}

      {/* Syncing Indicator */}
      {isSyncing && (
        <Badge
          variant="secondary"
          className="flex items-center gap-2 px-3 py-2 shadow-lg bg-purple-600 text-white animate-pulse"
        >
          <RefreshCw className="h-4 w-4 animate-spin" />
          Syncing...
        </Badge>
      )}

      {/* Manual Sync Button */}
      {isOnline && unsyncedCount > 0 && !isSyncing && (
        <Button
          size="sm"
          onClick={manualSync}
          className="shadow-lg"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Sync Now
        </Button>
      )}
    </div>
  );
};
