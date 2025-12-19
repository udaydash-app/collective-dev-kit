// Timbre Tax calculation based on bill amount
// Applied automatically to orders from January 1st

export interface TimbreTaxResult {
  taxAmount: number;
  taxName: string;
  isApplicable: boolean;
}

/**
 * Calculate Timbre tax based on bill amount
 * Rules:
 * - 5,001 - 100,000 = 100
 * - 100,001 - 500,000 = 500
 * - 500,001 - 1,000,000 = 1,000
 * - 1,000,001 - 5,000,000 = 2,000
 * - Above 5,000,000 = 5,000
 */
export function calculateTimbreTax(billAmount: number): TimbreTaxResult {
  const taxName = 'Timbre';
  
  // Check if date is on or after January 1st of the current year
  const now = new Date();
  const jan1st = new Date(now.getFullYear(), 0, 1); // January 1st of current year
  
  // For testing/development, we check if we're past Jan 1st 2024
  const effectiveDate = new Date(2024, 0, 1);
  if (now < effectiveDate) {
    return { taxAmount: 0, taxName, isApplicable: false };
  }
  
  // Bill amount must be greater than 5000 for tax to apply
  if (billAmount <= 5000) {
    return { taxAmount: 0, taxName, isApplicable: false };
  }
  
  let taxAmount = 0;
  
  if (billAmount >= 5001 && billAmount <= 100000) {
    taxAmount = 100;
  } else if (billAmount >= 100001 && billAmount <= 500000) {
    taxAmount = 500;
  } else if (billAmount >= 500001 && billAmount <= 1000000) {
    taxAmount = 1000;
  } else if (billAmount >= 1000001 && billAmount <= 5000000) {
    taxAmount = 2000;
  } else if (billAmount > 5000000) {
    taxAmount = 5000;
  }
  
  return {
    taxAmount,
    taxName,
    isApplicable: taxAmount > 0
  };
}

/**
 * Get Timbre tax bracket description
 */
export function getTimbreTaxBracket(billAmount: number): string {
  if (billAmount <= 5000) return 'No Timbre (≤5,000)';
  if (billAmount <= 100000) return '5,001 - 100,000 = 100';
  if (billAmount <= 500000) return '100,001 - 500,000 = 500';
  if (billAmount <= 1000000) return '500,001 - 1,000,000 = 1,000';
  if (billAmount <= 5000000) return '1,000,001 - 5,000,000 = 2,000';
  return 'Above 5,000,000 = 5,000';
}
