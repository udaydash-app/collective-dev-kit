type LedgerAmounts = { debit_amount?: number | string | null; credit_amount?: number | string | null };

export function sumLedgerAmounts(lines: LedgerAmounts[]) {
  return lines.reduce((totals, line) => ({
    debits: totals.debits + Number(line.debit_amount || 0),
    credits: totals.credits + Number(line.credit_amount || 0),
  }), { debits: 0, credits: 0 });
}

export function isDebitNormalAccount(account: { account_code?: string | null; account_type?: string | null }) {
  return String(account.account_code || '').startsWith('521') ||
    ['asset', 'expense', 'unified'].includes(account.account_type || '');
}