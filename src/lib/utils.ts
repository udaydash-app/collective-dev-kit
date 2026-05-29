import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Currency formatting for Côte d'Ivoire (West African CFA Franc)
export function formatCurrency(amount: number | null | undefined): string {
  const value = amount ?? 0;
  // Show decimals only if the value has fractional parts
  const hasDecimals = value % 1 !== 0;
  return `${value.toLocaleString('fr-CI', { 
    minimumFractionDigits: hasDecimals ? 2 : 0, 
    maximumFractionDigits: 2 
  })} FCFA`;
}

// Currency formatting without currency sign for compact displays
export function formatCurrencyCompact(amount: number | null | undefined): string {
  const value = amount ?? 0;
  // Show decimals only if the value has fractional parts
  const hasDecimals = value % 1 !== 0;
  return value.toLocaleString('fr-CI', { 
    minimumFractionDigits: hasDecimals ? 2 : 0, 
    maximumFractionDigits: 2 
  });
}

// Date formatting utilities - using dd/MM/yyyy format for Côte d'Ivoire
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '';
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return format(dateObj, 'dd/MM/yyyy');
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return '';
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return format(dateObj, 'dd/MM/yyyy HH:mm');
}

export function formatDateTimeFull(date: Date | string | null | undefined): string {
  if (!date) return '';
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return format(dateObj, 'dd/MM/yyyy HH:mm:ss');
}

// Effective unit cost = CIF cost_price + local_charges.
// Reports, P&L, Trading account, COGS and pricing screens should use this so
// landed cost (CIF + local charges) is reflected wherever cost is shown.
export function getEffectiveCost(
  item: { cost_price?: number | null; local_charges?: number | null } | null | undefined
): number {
  if (!item) return 0;
  return (Number(item.cost_price) || 0) + (Number(item.local_charges) || 0);
}

// For variants: variant has its own cost_price but inherits local_charges from parent product.
export function getVariantEffectiveCost(
  variant: { cost_price?: number | null } | null | undefined,
  product: { cost_price?: number | null; local_charges?: number | null } | null | undefined
): number {
  const base = Number(variant?.cost_price) || Number(product?.cost_price) || 0;
  const charges = Number(product?.local_charges) || 0;
  return base + charges;
}
