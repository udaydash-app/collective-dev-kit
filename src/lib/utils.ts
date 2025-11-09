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
