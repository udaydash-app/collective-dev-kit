import { supabase } from "@/integrations/supabase/client";

/**
 * Accounts Receivable aging.
 *
 * Built from the same source of truth as the General Ledger: posted
 * journal_entry_lines on each customer's 411x ledger account. Debits are
 * treated as open invoices, credits (payments / credit notes) are applied
 * FIFO against the oldest debits. Whatever remains open is bucketed by the
 * age of its entry date relative to the "as of" date.
 *
 * Opening balances live on contacts.opening_balance (journal entries whose
 * description mentions "opening balance" are skipped, matching GL).
 */

export interface AgingDoc {
  id: string;
  date: string | null; // null = opening balance
  reference: string;
  description: string;
  amount: number; // still open
  days: number;
  bucket: BucketKey;
}

export type BucketKey = "current" | "b30" | "b60" | "b90" | "b90plus";

export interface AgingRow {
  contact_id: string;
  name: string;
  phone: string | null;
  total: number;
  buckets: Record<BucketKey, number>;
  docs: AgingDoc[];
  lastBillDate: string | null;
  lastPaymentDate: string | null;
  daysSinceLastBill: number | null;
  daysSinceLastPayment: number | null;
}

export interface AgingResult {
  rows: AgingRow[];
  totals: Record<BucketKey, number> & { total: number };
}

const emptyBuckets = (): Record<BucketKey, number> => ({
  current: 0,
  b30: 0,
  b60: 0,
  b90: 0,
  b90plus: 0,
});

const daysBetween = (asOf: string, date: string) =>
  Math.floor(
    (new Date(`${asOf}T00:00:00`).getTime() - new Date(`${date}T00:00:00`).getTime()) /
      86400000,
  );

export const bucketFor = (days: number): BucketKey => {
  if (days <= 0) return "current";
  if (days <= 30) return "b30";
  if (days <= 60) return "b60";
  if (days <= 90) return "b90";
  return "b90plus";
};

export const BUCKET_LABELS: Record<BucketKey, string> = {
  current: "Current",
  b30: "1-30 days",
  b60: "31-60 days",
  b90: "61-90 days",
  b90plus: "90+ days",
};

export async function fetchReceivablesAging(asOf: string): Promise<AgingResult> {
  const { data: contacts, error: cErr } = await supabase
    .from("contacts")
    .select("id, name, phone, opening_balance, customer_ledger_account_id")
    .eq("is_customer", true)
    .order("name");
  if (cErr) throw cErr;

  const accountIds = (contacts ?? [])
    .map((c: any) => c.customer_ledger_account_id)
    .filter(Boolean) as string[];
  if (accountIds.length === 0) {
    return { rows: [], totals: { ...emptyBuckets(), total: 0 } };
  }

  // Pull every posted line for these accounts up to the as-of date.
  const linesByAccount = new Map<string, any[]>();
  const chunkSize = 100;
  const pageSize = 1000;
  for (let i = 0; i < accountIds.length; i += chunkSize) {
    const chunk = accountIds.slice(i, i + chunkSize);
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabase
        .from("journal_entry_lines")
        .select(
          `id, account_id, debit_amount, credit_amount, description,
           journal_entries!inner (entry_date, entry_number, description, status)`,
        )
        .in("account_id", chunk)
        .eq("journal_entries.status", "posted")
        .lte("journal_entries.entry_date", asOf)
        .order("id", { ascending: true })
        .range(from, from + pageSize - 1);
      if (error) throw error;
      const rows = (data ?? []) as any[];
      for (const line of rows) {
        const je = line.journal_entries;
        const desc = String(je?.description ?? "").toLowerCase();
        if (desc.includes("opening balance")) continue;
        const list = linesByAccount.get(line.account_id) ?? [];
        list.push(line);
        linesByAccount.set(line.account_id, list);
      }
      if (rows.length < pageSize) break;
    }
  }

  const rows: AgingRow[] = [];
  const totals = { ...emptyBuckets(), total: 0 };

  for (const c of (contacts ?? []) as any[]) {
    const accountId = c.customer_ledger_account_id;
    if (!accountId) continue;
    const lines = (linesByAccount.get(accountId) ?? []).slice().sort((a, b) => {
      const da = a.journal_entries?.entry_date ?? "";
      const db = b.journal_entries?.entry_date ?? "";
      return da === db ? String(a.id).localeCompare(String(b.id)) : da < db ? -1 : 1;
    });

    const open: AgingDoc[] = [];
    const opening = Number(c.opening_balance || 0);
    if (opening > 0) {
      open.push({
        id: `${c.id}-opening`,
        date: null,
        reference: "Opening balance",
        description: "Opening balance",
        amount: opening,
        days: 9999,
        bucket: "b90plus",
      });
    }

    let credit = 0;
    let lastBillDate: string | null = null;
    let lastPaymentDate: string | null = null;
    for (const l of lines) {
      const d = Number(l.debit_amount || 0);
      const cr = Number(l.credit_amount || 0);
      if (d > 0) {
        const date = l.journal_entries?.entry_date ?? asOf;
        const days = daysBetween(asOf, date);
        open.push({
          id: l.id,
          date,
          reference: l.journal_entries?.entry_number ?? "—",
          description: l.description || l.journal_entries?.description || "—",
          amount: d,
          days,
          bucket: bucketFor(days),
        });
      }
      const entryDate: string | null = l.journal_entries?.entry_date ?? null;
      if (d > 0 && entryDate && (!lastBillDate || entryDate > lastBillDate)) {
        lastBillDate = entryDate;
      }
      if (cr > 0) {
        credit += cr;
        if (entryDate && (!lastPaymentDate || entryDate > lastPaymentDate)) {
          lastPaymentDate = entryDate;
        }
      }
    }

    // Apply all credits FIFO against the oldest open debits.
    for (const doc of open) {
      if (credit <= 0) break;
      const applied = Math.min(credit, doc.amount);
      doc.amount -= applied;
      credit -= applied;
    }

    const remaining = open.filter((d) => d.amount > 0.005);
    if (remaining.length === 0) continue;

    const buckets = emptyBuckets();
    let total = 0;
    for (const d of remaining) {
      buckets[d.bucket] += d.amount;
      total += d.amount;
    }
    if (total <= 0.005) continue;

    rows.push({
      contact_id: c.id,
      name: c.name,
      phone: c.phone ?? null,
      total,
      buckets,
      docs: remaining,
      lastBillDate,
      lastPaymentDate,
      daysSinceLastBill: lastBillDate ? daysBetween(asOf, lastBillDate) : null,
      daysSinceLastPayment: lastPaymentDate ? daysBetween(asOf, lastPaymentDate) : null,
    });

    (Object.keys(buckets) as BucketKey[]).forEach((k) => {
      totals[k] += buckets[k];
    });
    totals.total += total;
  }

  rows.sort((a, b) => b.total - a.total);
  return { rows, totals };
}
