import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";

export default function Index() {
  const [destination, setDestination] = useState<string | null>(null);

  useEffect(() => {
    // Check if running as Electron desktop app
    const isElectron = !!(window as any).electron;
    
    // Check if running as installed PWA (standalone mode)
    const isPWA = window.matchMedia('(display-mode: standalone)').matches ||
                  (window.navigator as any).standalone === true;
    
    // Only redirect to POS login for actual PWA/Electron apps
    // Regular website visitors ALWAYS go to home page
    if (isElectron || isPWA) {
      setDestination("/pos-login");
    } else {
      setDestination("/home");
    }
  }, []);

  // Wait for detection - default to home if taking too long
  if (destination === null) {
    // Show nothing briefly while detecting, but ensure we don't get stuck
    return null;
  }

  return <Navigate to={destination} replace />;
}
