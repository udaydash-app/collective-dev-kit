import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Currency formatting for Côte d'Ivoire (West African CFA Franc)
export function formatCurrency(amount: number): string {
  return `${amount.toLocaleString('fr-CI', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} FCFA`;
}
