import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";

export default function Index() {
  const [destination, setDestination] = useState<string | null>(null);

  useEffect(() => {
    // Windows desktop app must always start at PIN login; a previous POS
    // session should not auto-open /admin/pos on app launch.
    const isElectron = !!(window as any).electron;
    const isPWA = window.matchMedia('(display-mode: standalone)').matches ||
                  (window.navigator as any).standalone === true;

    if (isElectron || isPWA) {
      setDestination("/pos-login");
      return;
    }

    // If a POS PIN session exists, always return to the POS app
    try {
      const sessRaw = localStorage.getItem("offline_pos_session");
      if (sessRaw) {
        const sess = JSON.parse(sessRaw);
        const isAdmin = (sess?.full_name || "").toLowerCase() === "admin";
        setDestination(isAdmin ? "/admin/dashboard-modern" : "/admin/pos");
        return;
      }
    } catch {}

    setDestination("/home");
  }, []);

  // Wait for detection - default to home if taking too long
  if (destination === null) {
    // Show nothing briefly while detecting, but ensure we don't get stuck
    return null;
  }

  return <Navigate to={destination} replace />;
}
