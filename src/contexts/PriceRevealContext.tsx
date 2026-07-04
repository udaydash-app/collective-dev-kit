import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

/**
 * F12 momentary reveal for real (unmasked) selling prices.
 *
 * - Pressing F12 flips `revealRealPrice` to true for `REVEAL_MS` ms.
 * - Pressing F12 again while active refreshes the window.
 * - The listener lives only inside <PriceRevealProvider>, which is mounted
 *   on the POS/Admin route subtree.
 *
 * Consumers read `useRevealRealPrice()` (or `useMaybeRevealRealPrice()`
 * outside the provider, which safely returns `false`).
 */

const REVEAL_MS = 3000;

interface PriceRevealContextValue {
  revealRealPrice: boolean;
  flash: () => void; // programmatic trigger (e.g. right before a print)
}

const PriceRevealContext = createContext<PriceRevealContextValue | null>(null);

export const PriceRevealProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [revealRealPrice, setRevealRealPrice] = useState(false);
  const timerRef = useRef<number | null>(null);

  const flash = useCallback(() => {
    setRevealRealPrice(true);
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setRevealRealPrice(false);
      timerRef.current = null;
    }, REVEAL_MS);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'F12') {
        // Prevent browsers/Electron from opening devtools while masking is active.
        event.preventDefault();
        event.stopPropagation();
        flash();
      }
    };
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => {
      window.removeEventListener('keydown', onKeyDown, { capture: true } as any);
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, [flash]);

  const value = useMemo(() => ({ revealRealPrice, flash }), [revealRealPrice, flash]);

  return <PriceRevealContext.Provider value={value}>{children}</PriceRevealContext.Provider>;
};

export const useRevealRealPrice = (): boolean => {
  const ctx = useContext(PriceRevealContext);
  return ctx?.revealRealPrice ?? false;
};

export const usePriceRevealControls = (): PriceRevealContextValue => {
  const ctx = useContext(PriceRevealContext);
  return ctx ?? { revealRealPrice: false, flash: () => undefined };
};

/** Snapshot the current reveal state at the moment of an event (e.g. click a print button). */
export const useCurrentRevealSnapshot = () => {
  const ctx = useContext(PriceRevealContext);
  return () => ctx?.revealRealPrice ?? false;
};