/**
 * Masked selling price helpers (POS/Admin only).
 *
 * Formula:
 *   maskedPrice = ceilTo500((cost_price + local_charges) * 1.25)
 * If cost data is missing (0 or undefined), fall back to the real price so
 * the UI never shows 0 FCFA on products with incomplete cost records.
 *
 * The gating (only inside a valid POS session) and the F12 momentary reveal
 * live in PriceRevealContext + usePriceMasking. This module is pure math so
 * it can be called from any layer.
 */

export const MARKUP_MULTIPLIER = 1.25;
export const ROUND_STEP = 100;

export const ceilTo500 = (value: number): number => {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.ceil(value / ROUND_STEP) * ROUND_STEP;
};

export interface CostBearing {
  price?: number | null;
  cost_price?: number | null;
  local_charges?: number | null;
}

/**
 * Compute the masked selling price for a product/variant.
 * - variant carries its own cost_price; local_charges live on the parent product.
 * - When cost data is missing, we fall back to the real price so the cashier
 *   still sees a usable number.
 */
export const computeMaskedPrice = (
  source: CostBearing,
  fallbacks: { local_charges?: number | null; price?: number | null } = {}
): number => {
  const cost = Number(source.cost_price ?? 0) || 0;
  const localCharges = Number(source.local_charges ?? fallbacks.local_charges ?? 0) || 0;
  const realPrice = Number(source.price ?? fallbacks.price ?? 0) || 0;

  const base = cost + localCharges;
  if (base <= 0) {
    // No cost info recorded — keep the real price visible.
    return realPrice;
  }
  const masked = ceilTo500(base * MARKUP_MULTIPLIER);
  return masked > 0 ? masked : realPrice;
};

/**
 * Pick between masked and real value depending on the reveal state.
 * `revealed` is expected to already respect the session gate.
 */
export const pickPrice = (
  maskedValue: number | null | undefined,
  realValue: number | null | undefined,
  revealed: boolean
): number => {
  if (revealed) return Number(realValue ?? maskedValue ?? 0) || 0;
  return Number(maskedValue ?? realValue ?? 0) || 0;
};