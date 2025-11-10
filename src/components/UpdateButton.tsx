import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2, Info } from 'lucide-react';
import { toast } from 'sonner';

interface UpdateButtonProps {
  showVersion?: boolean;
  compact?: boolean;
}

export function UpdateButton({ showVersion = false, compact = false }: UpdateButtonProps) {
  const [checking, setChecking] = useState(false);
  const version = '1.0.20'; // App version from GitHub

  const checkForUpdates = async () => {
    if (!window.electron?.checkForUpdates) {
      toast.info('Manual update check - Web version always uses latest deployed version');
      return;
    }

    setChecking(true);
    toast.loading('Checking for updates...', { id: 'update-check' });
    
    try {
      const result = await window.electron.checkForUpdates();
      
      if (result.success) {
        if (result.updateInfo) {
          toast.success('Update available! Download will start automatically.', { id: 'update-check' });
        } else {
          toast.success(`You are running the latest version (v${version})`, { id: 'update-check' });
        }
      } else {
        toast.error(result.error || 'Failed to check for updates', { id: 'update-check' });
      }
    } catch (error) {
      toast.error('Failed to check for updates', { id: 'update-check' });
    } finally {
      setChecking(false);
    }
  };

  if (compact) {
    return (
      <Button
        onClick={checkForUpdates}
        disabled={checking}
        variant="ghost"
        size="sm"
        className="gap-2 h-auto py-1.5 px-2 justify-start w-full"
      >
        {checking ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Download className="h-3 w-3" />
        )}
        <span className="text-xs">{checking ? 'Checking...' : 'Check for Updates'}</span>
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {showVersion && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Info className="h-3 w-3" />
          <span>v{version}</span>
        </div>
      )}
      <Button
        onClick={checkForUpdates}
        disabled={checking}
        variant="outline"
        size="sm"
        className="gap-2"
      >
        {checking ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        {checking ? 'Checking...' : 'Check for Updates'}
      </Button>
    </div>
  );
}
