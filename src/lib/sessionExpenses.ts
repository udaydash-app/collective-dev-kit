// Decides whether an expense belongs to the open cash session's expected cash.
// Rule: it must have been entered during the session (created_at >= opened_at)
// and dated on or after the day the session was opened (so back-dated
// expenses from earlier days never hit the till). Sessions that run past
// midnight keep counting expenses dated on any day since they opened.
const toLocalDate = (d: string | Date) => new Date(d).toLocaleDateString('en-CA'); // yyyy-MM-dd

export interface SessionLike {
  opened_at: string;
  store_id?: string | null;
}

export interface ExpenseLike {
  created_at: string;
  expense_date?: string | null;
  store_id?: string | null;
}

export function sessionStartDate(session: SessionLike): string {
  return toLocalDate(session.opened_at);
}

export function isExpenseInSession(expense: ExpenseLike, session: SessionLike, now: Date = new Date()): boolean {
  if (session.store_id && expense.store_id && expense.store_id !== session.store_id) return false;
  if (new Date(expense.created_at).getTime() < new Date(session.opened_at).getTime()) return false;
  const d = (expense.expense_date || toLocalDate(expense.created_at)).slice(0, 10);
  return d >= sessionStartDate(session) && d <= toLocalDate(now);
}
