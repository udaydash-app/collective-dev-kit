import { useEffect, useState } from 'react';
import { useRevealRealPrice } from '@/contexts/PriceRevealContext';

/**
 * Gate the masking feature to authenticated POS sessions only.
 * Masking is enabled iff `offline_pos_session` is present in localStorage.
 * Storefront pages have no such session and therefore no masking.
 */

const hasPosSession = () => {
  try {
    return !!localStorage.getItem('offline_pos_session');
  } catch {
    return false;
  }
};

export const usePriceMasking = () => {
  const [enabled, setEnabled] = useState<boolean>(() => hasPosSession());
  const revealRealPrice = useRevealRealPrice();

  useEffect(() => {
    const refresh = () => setEnabled(hasPosSession());
    window.addEventListener('storage', refresh);
    window.addEventListener('offline-pos-session-changed', refresh);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('offline-pos-session-changed', refresh);
    };
  }, []);

  return {
    /** True when a POS session is active and the feature applies. */
    maskingEnabled: enabled,
    /** True when the cashier is holding F12 (reveal window active). */
    revealRealPrice,
    /** Convenience: show masked value iff masking is enabled AND F12 is NOT active. */
    showMasked: enabled && !revealRealPrice,
  };
};