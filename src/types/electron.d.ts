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
    updateFromLocalFolder: () => Promise<{
      success: boolean;
      installer?: string;
      error?: string;
    }>;
    onDownloadProgress: (callback: (progress: {
      bytesPerSecond: number;
      percent: number;
      transferred: number;
      total: number;
    }) => void) => void;
    print: (html: string) => Promise<void>;
    isElectron: boolean;
  };
}
