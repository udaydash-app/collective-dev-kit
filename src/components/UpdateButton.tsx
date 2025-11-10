import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export function UpdateButton() {
  const [checking, setChecking] = useState(false);

  const checkForUpdates = async () => {
    if (!window.electron?.checkForUpdates) {
      toast.error('Update check not available in web version');
      return;
    }

    setChecking(true);
    try {
      const result = await window.electron.checkForUpdates();
      
      if (result.success) {
        if (result.updateInfo) {
          toast.success('Update available! Download will start automatically.');
        } else {
          toast.success('You are running the latest version');
        }
      } else {
        toast.error(result.error || 'Failed to check for updates');
      }
    } catch (error) {
      toast.error('Failed to check for updates');
    } finally {
      setChecking(false);
    }
  };

  // Only show button in Electron app
  if (!window.electron?.isElectron) {
    return null;
  }

  return (
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
  );
}
