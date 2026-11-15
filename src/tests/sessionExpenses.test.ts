import { describe, it, expect } from 'vitest';
import { isExpenseInSession } from '@/lib/sessionExpenses';

const session = { opened_at: '2026-11-13T20:07:08', store_id: 's1' };
const now = new Date('2026-11-15T09:00:00');

describe('isExpenseInSession', () => {
  it('counts an expense dated yesterday but entered during a session that opened before midnight', () => {
    expect(isExpenseInSession({ created_at: '2026-11-15T08:41:54', expense_date: '2026-11-14', store_id: 's1' }, session, now)).toBe(true);
  });

  it('counts an expense dated today entered during the session', () => {
    expect(isExpenseInSession({ created_at: '2026-11-15T08:41:54', expense_date: '2026-11-15', store_id: 's1' }, session, now)).toBe(true);
  });

  it('excludes an expense entered before the session opened', () => {
    expect(isExpenseInSession({ created_at: '2026-11-13T17:59:52', expense_date: '2026-11-13', store_id: 's1' }, session, now)).toBe(false);
  });

  it('excludes an expense back-dated before the session opening day', () => {
    expect(isExpenseInSession({ created_at: '2026-11-15T08:00:00', expense_date: '2026-11-12', store_id: 's1' }, session, now)).toBe(false);
  });

  it('excludes an expense from another store', () => {
    expect(isExpenseInSession({ created_at: '2026-11-15T08:41:54', expense_date: '2026-11-15', store_id: 's2' }, session, now)).toBe(false);
  });
});
