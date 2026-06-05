// App-wide money/number/date formatter.
// Reads the user's profile (currency symbol, locale, decimals, symbol position,
// date format) from an in-memory store primed by useFormatProfile() in AppLayout.
// Falls back to en-US / $ / yyyy-MM-dd before the profile loads.

import { format as dfFormat, parseISO, isValid } from "date-fns";

export interface FormatSettings {
  currency_symbol: string;
  currency_position: "before" | "after";
  number_format: string;   // BCP-47 locale
  decimal_places: number;
  base_currency: string;
  date_format: string;     // date-fns pattern, e.g. "dd/MM/yyyy"
}

const defaults: FormatSettings = {
  currency_symbol: "$",
  currency_position: "before",
  number_format: "en-US",
  decimal_places: 2,
  base_currency: "USD",
  date_format: "yyyy-MM-dd",
};

let current: FormatSettings = { ...defaults };
const listeners = new Set<() => void>();

export const setFormatSettings = (s: Partial<FormatSettings> | null | undefined) => {
  if (!s) return;
  current = {
    currency_symbol: s.currency_symbol ?? current.currency_symbol,
    currency_position: (s.currency_position as "before" | "after") ?? current.currency_position,
    number_format: s.number_format ?? current.number_format,
    decimal_places: s.decimal_places ?? current.decimal_places,
    base_currency: s.base_currency ?? current.base_currency,
    date_format: s.date_format ?? current.date_format,
  };
  listeners.forEach((l) => l());
};

export const getFormatSettings = (): FormatSettings => current;

export const subscribeFormatSettings = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const formatNumber = (n: number | string | null | undefined, digits?: number) => {
  const v = typeof n === "string" ? parseFloat(n) : n ?? 0;
  const d = digits ?? current.decimal_places;
  return new Intl.NumberFormat(current.number_format, {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  }).format(v || 0);
};

// Backwards-compatible signature: second arg (currency) is now ignored —
// we use the user's configured symbol & position instead.
export const formatMoney = (n: number | string | null | undefined, _currency?: string) => {
  const num = formatNumber(n);
  return current.currency_position === "after"
    ? `${num}\u00A0${current.currency_symbol}`
    : `${current.currency_symbol}${num}`;
};

/**
 * Format a date according to the user's `date_format` profile setting.
 * Accepts: ISO string ("2025-12-31"), full ISO datetime, Date, null/undefined.
 * Returns "" for null/undefined/invalid input so it's safe to use directly in JSX.
 */
export const formatDate = (
  input: string | Date | null | undefined,
  pattern?: string,
) => {
  if (!input) return "";
  const d = input instanceof Date ? input : parseISO(input);
  if (!isValid(d)) return typeof input === "string" ? input : "";
  try {
    return dfFormat(d, pattern ?? current.date_format);
  } catch {
    return dfFormat(d, "yyyy-MM-dd");
  }
};
