import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Currency formatting for Côte d'Ivoire (West African CFA Franc)
export function formatCurrency(amount: number | null | undefined): string {
  const value = amount ?? 0;
  return `${value.toLocaleString('fr-CI', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} FCFA`;
}

// Currency formatting without currency sign for compact displays
export function formatCurrencyCompact(amount: number | null | undefined): string {
  const value = amount ?? 0;
  return value.toLocaleString('fr-CI', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// Date formatting utilities
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
