import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";

export default function Index() {
  const [isPWAOrDesktop, setIsPWAOrDesktop] = useState<boolean | null>(null);

  useEffect(() => {
    // Check if running as Electron
    const isElectron = !!(window as any).electron;
    
    // Check if running as installed PWA
    const isPWA = window.matchMedia('(display-mode: standalone)').matches ||
                  (window.navigator as any).standalone === true;
    
    setIsPWAOrDesktop(isElectron || isPWA);
  }, []);

  // Wait for detection
  if (isPWAOrDesktop === null) {
    return null;
  }

  // PWA/Desktop → POS Login, Website visitors → Home
  return <Navigate to={isPWAOrDesktop ? "/pos-login" : "/home"} replace />;
}
