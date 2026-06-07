/**
 * Detect whether the app is running as an installed PWA or inside Electron.
 * Used to gate sensitive routes (e.g. General Ledger) to browser-only access.
 */
export const isElectronApp = (): boolean => {
  if (typeof window === 'undefined') return false;
  const w = window as any;
  if (w.electron || w.electronAPI) return true;
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
  return /electron/i.test(ua);
};

export const isInstalledPWA = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    if (window.matchMedia?.('(display-mode: standalone)').matches) return true;
    if (window.matchMedia?.('(display-mode: fullscreen)').matches) return true;
    if (window.matchMedia?.('(display-mode: minimal-ui)').matches) return true;
  } catch { /* ignore */ }
  if ((navigator as any).standalone === true) return true;
  return false;
};

export const isPWAorElectron = (): boolean => isElectronApp() || isInstalledPWA();