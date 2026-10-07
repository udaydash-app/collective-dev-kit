import { describe, expect, it } from 'vitest';
import { isDebitNormalAccount, sumLedgerAmounts } from '@/lib/generalLedgerSummary';

describe('General Ledger summaries', () => {
  it('includes prior-period rows and more than 1000 entries', () => {
    const prior = Array.from({ length: 1396 }, () => ({ debit_amount: '10', credit_amount: '20' }));
    const current = [{ debit_amount: 100, credit_amount: 50 }];
    expect(sumLedgerAmounts([...prior, ...current])).toEqual({ debits: 14060, credits: 27970 });
    expect(sumLedgerAmounts(current)).toEqual({ debits: 100, credits: 50 });
  });

  it('combines both sides of a unified account without reversing debit and credit totals', () => {
    expect(sumLedgerAmounts([{ debit_amount: 100 }, { credit_amount: 80 }]))
      .toEqual({ debits: 100, credits: 80 });
  });

  it('keeps 521 and its subaccounts debit-normal even with legacy liability metadata', () => {
    for (const account_code of ['521', '5211', '5212']) {
      expect(isDebitNormalAccount({ account_code, account_type: 'liability' })).toBe(true);
    }
    const { debits, credits } = sumLedgerAmounts([{ debit_amount: 100, credit_amount: 200 }]);
    expect(debits - credits).toBe(-100);
    expect(isDebitNormalAccount({ account_code: '401', account_type: 'liability' })).toBe(false);
  });
});