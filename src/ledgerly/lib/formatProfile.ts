// Centralised number / money formatting that respects the user's profile settings.
// Pass profile from a single fetch; falls back to sensible defaults.

export interface FormatProfile {
  base_currency?: string | null;
  currency_symbol?: string | null;
  currency_position?: "before" | "after" | null;
  number_format?: string | null;   // BCP-47 locale e.g. "en-US", "de-DE", "en-IN"
  decimal_places?: number | null;
}

const defaults: Required<FormatProfile> = {
  base_currency: "USD",
  currency_symbol: "$",
  currency_position: "before",
  number_format: "en-US",
  decimal_places: 2,
};

const merge = (p?: FormatProfile | null): Required<FormatProfile> => ({
  base_currency: p?.base_currency ?? defaults.base_currency,
  currency_symbol: p?.currency_symbol ?? defaults.currency_symbol,
  currency_position: (p?.currency_position as "before" | "after") ?? defaults.currency_position,
  number_format: p?.number_format ?? defaults.number_format,
  decimal_places: p?.decimal_places ?? defaults.decimal_places,
});

export const fmtNumber = (n: number | string | null | undefined, profile?: FormatProfile | null, digits?: number) => {
  const cfg = merge(profile);
  const d = digits ?? cfg.decimal_places;
  const v = typeof n === "string" ? parseFloat(n) : n ?? 0;
  return new Intl.NumberFormat(cfg.number_format, {
    minimumFractionDigits: d, maximumFractionDigits: d,
  }).format(v || 0);
};

export const fmtMoney = (n: number | string | null | undefined, profile?: FormatProfile | null) => {
  const cfg = merge(profile);
  const num = fmtNumber(n, profile);
  return cfg.currency_position === "after" ? `${num} ${cfg.currency_symbol}` : `${cfg.currency_symbol}${num}`;
};
