// TypeScript definitions for Electron API
interface Window {
  electron?: {
    getVersion: () => Promise<string>;
    getPath: (name: string) => Promise<string>;
    checkForUpdates: () => Promise<{
      success: boolean;
      updateInfo?: any;
      error?: string;
    }>;
    onDownloadProgress: (callback: (progress: {
      bytesPerSecond: number;
      percent: number;
      transferred: number;
      total: number;
    }) => void) => void;
    isElectron: boolean;
  };
}
