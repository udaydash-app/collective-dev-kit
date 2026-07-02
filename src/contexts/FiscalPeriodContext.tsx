import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type FiscalPeriodValue = "current" | "before";

export interface FiscalPeriodCtx {
  period: FiscalPeriodValue;
  setPeriod: (p: FiscalPeriodValue) => void;
  incorporationDate: string; // ISO yyyy-mm-dd
  /** Inclusive lower bound for report date filters. null means "no lower bound" (before-incorporation view). */
  effectiveFrom: string | null;
  /** Inclusive upper bound. null means "no upper bound" (open current period). */
  effectiveTo: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const DEFAULT_INCORP = "2026-07-01";
const LS_KEY = "fiscalPeriod";

const Ctx = createContext<FiscalPeriodCtx>({
  period: "current",
  setPeriod: () => {},
  incorporationDate: DEFAULT_INCORP,
  effectiveFrom: DEFAULT_INCORP,
  effectiveTo: null,
  loading: true,
  refresh: async () => {},
});

function computeBounds(period: FiscalPeriodValue, incorp: string) {
  if (period === "current") return { effectiveFrom: incorp, effectiveTo: null as string | null };
  // "before": everything up to the day before incorporation
  const d = new Date(incorp + "T00:00:00");
  d.setDate(d.getDate() - 1);
  const prior = d.toISOString().slice(0, 10);
  return { effectiveFrom: null as string | null, effectiveTo: prior };
}

export const FiscalPeriodProvider = ({ children }: { children: ReactNode }) => {
  const [incorporationDate, setIncorporationDate] = useState<string>(DEFAULT_INCORP);
  const [period, setPeriodState] = useState<FiscalPeriodValue>(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem(LS_KEY) : null;
    return saved === "before" ? "before" : "current";
  });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data } = await (supabase as any)
        .from("settings")
        .select("incorporation_date, active_period")
        .limit(1)
        .maybeSingle();
      if (data?.incorporation_date) setIncorporationDate(data.incorporation_date);
      const saved = localStorage.getItem(LS_KEY);
      if (!saved && data?.active_period) {
        setPeriodState(data.active_period === "before" ? "before" : "current");
      }
    } catch {
      /* offline / missing columns — fall back to defaults */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const setPeriod = (p: FiscalPeriodValue) => {
    setPeriodState(p);
    try { localStorage.setItem(LS_KEY, p); } catch {}
    window.dispatchEvent(new CustomEvent("fiscal-period-changed", { detail: p }));
  };

  const { effectiveFrom, effectiveTo } = computeBounds(period, incorporationDate);

  return (
    <Ctx.Provider value={{ period, setPeriod, incorporationDate, effectiveFrom, effectiveTo, loading, refresh: load }}>
      {children}
    </Ctx.Provider>
  );
};

export const useFiscalPeriod = () => useContext(Ctx);

/** Utility for pages that want defaults without subscribing. */
export function readFiscalPeriodBoundsSync(): { period: FiscalPeriodValue; effectiveFrom: string | null; effectiveTo: string | null; incorporationDate: string } {
  const saved = typeof window !== "undefined" ? localStorage.getItem(LS_KEY) : null;
  const period: FiscalPeriodValue = saved === "before" ? "before" : "current";
  const incorp = DEFAULT_INCORP;
  return { period, incorporationDate: incorp, ...computeBounds(period, incorp) };
}

/** Clamp a yyyy-mm-dd date string into the active fiscal window. */
export function clampToFiscal(date: string | null | undefined): string {
  const { effectiveFrom, effectiveTo } = readFiscalPeriodBoundsSync();
  const today = new Date().toISOString().slice(0, 10);
  let d = (date && date.length >= 10) ? date : today;
  if (effectiveFrom && d < effectiveFrom) d = effectiveFrom;
  if (effectiveTo && d > effectiveTo) d = effectiveTo;
  return d;
}