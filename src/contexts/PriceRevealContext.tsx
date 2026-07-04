import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

/**
 * F12 sticky toggle for masked selling prices.
 *
 * - Default: real prices are shown everywhere (`revealRealPrice = true`).
 * - Pressing F12 toggles masking on; press again to reveal real prices.
 * - The listener lives only inside <PriceRevealProvider>, which is mounted
 *   on the POS/Admin route subtree.
 */

interface PriceRevealContextValue {
  revealRealPrice: boolean;
  flash: () => void; // programmatic trigger (kept for print/share buttons)
  reset: () => void; // programmatic reset (e.g. on dialog close)
}

const PriceRevealContext = createContext<PriceRevealContextValue | null>(null);

export const PriceRevealProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Default to true: real prices are shown by default across the app.
  // F12 toggles masking on (revealRealPrice=false → showMasked=true).
  const [revealRealPrice, setRevealRealPrice] = useState(true);

  const flash = useCallback(() => setRevealRealPrice(true), []);
  // reset() returns to the default (real prices visible).
  const reset = useCallback(() => setRevealRealPrice(true), []);
  const toggle = useCallback(() => setRevealRealPrice((v) => !v), []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'F12') {
        // Prevent browsers/Electron from opening devtools while masking is active.
        event.preventDefault();
        event.stopPropagation();
        toggle();
      }
    };
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => {
      window.removeEventListener('keydown', onKeyDown, { capture: true } as any);
    };
  }, [toggle]);

  const value = useMemo(() => ({ revealRealPrice, flash, reset }), [revealRealPrice, flash, reset]);

  return <PriceRevealContext.Provider value={value}>{children}</PriceRevealContext.Provider>;
};

export const useRevealRealPrice = (): boolean => {
  const ctx = useContext(PriceRevealContext);
  return ctx?.revealRealPrice ?? true;
};

export const usePriceRevealControls = (): PriceRevealContextValue => {
  const ctx = useContext(PriceRevealContext);
  return ctx ?? { revealRealPrice: true, flash: () => undefined, reset: () => undefined };
};

/** Snapshot the current reveal state at the moment of an event (e.g. click a print button). */
export const useCurrentRevealSnapshot = () => {
  const ctx = useContext(PriceRevealContext);
  return () => ctx?.revealRealPrice ?? true;
};