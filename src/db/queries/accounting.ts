import { connectPowerSync } from "@/db/powersync";

// Local-first reads for the Accounting module. Reads journal entries +
// lines + accounts from the local PowerSync SQLite mirror so the pages
// open instantly and work offline. Writes still go through Supabase and
// stream back via PowerSync replication.

type Row = Record<string, any>;
const rowsOf = (res: any): Row[] =>
  Array.isArray(res) ? res : (res?.rows?._array ?? []);
const toBool = (v: any) => v === 1 || v === true;

export async function fetchAccountsLocal(opts: { includeInactive?: boolean } = {}): Promise<any[]> {
  const db = await connectPowerSync();
  const where = opts.includeInactive ? "" : "WHERE is_active = 1";
  const res: any = await db.getAll(
    `SELECT id, account_code, account_name, account_type, description,
            parent_account_id, opening_balance, current_balance, is_active,
            created_at, updated_at
     FROM accounts ${where} ORDER BY account_code`,
  );
  return rowsOf(res).map((r) => ({ ...r, is_active: toBool(r.is_active) }) as any);
}

export async function fetchContactsForLedgerLocal(): Promise<any[]> {
  const db = await connectPowerSync();
  const res: any = await db.getAll(
    `SELECT id, name, is_customer, is_supplier,
            customer_ledger_account_id, supplier_ledger_account_id,
            opening_balance, supplier_opening_balance
     FROM contacts ORDER BY name`,
  );
  return rowsOf(res).map((r) => ({
    ...r,
    is_customer: toBool(r.is_customer),
    is_supplier: toBool(r.is_supplier),
  }));
}

export async function fetchAccountsWithParentLocal(): Promise<any[]> {
  const db = await connectPowerSync();
  const res: any = await db.getAll(
    `SELECT a.*, p.account_name AS parent_account_name, p.account_code AS parent_account_code
     FROM accounts a
     LEFT JOIN accounts p ON p.id = a.parent_account_id
     WHERE a.is_active = 1
     ORDER BY a.account_code`,
  );
  return rowsOf(res).map((r: any) => ({
    ...r,
    is_active: toBool(r.is_active),
    parent: r.parent_account_name
      ? { account_name: r.parent_account_name, account_code: r.parent_account_code }
      : null,
  }));
}

export async function fetchExpensesLocal(storeId: string): Promise<any[]> {
  if (!storeId) return [];
  const db = await connectPowerSync();
  const res: any = await db.getAll(
    `SELECT * FROM expenses WHERE store_id = ?
     ORDER BY expense_date DESC, created_at DESC`,
    [storeId],
  );
  return rowsOf(res);
}

export interface LocalJournalFilter {
  start?: Date | null;
  end?: Date | null;
  searchQuery?: string;
  page?: number;
  pageSize?: number;
}

export async function fetchJournalEntriesLocal(filter: LocalJournalFilter) {
  const db = await connectPowerSync();
  const { start, end, searchQuery = "", page = 0, pageSize = 100 } = filter;
  const q = searchQuery.trim().toLowerCase();
  const isSearching = !!(q || start || end);

  const clauses: string[] = [];
  const args: any[] = [];
  if (start) {
    clauses.push("entry_date >= ?");
    args.push(start.toISOString().split("T")[0]);
  }
  if (end) {
    clauses.push("entry_date <= ?");
    args.push(end.toISOString().split("T")[0]);
  }
  if (q) {
    clauses.push(
      "(LOWER(entry_number) LIKE ? OR LOWER(description) LIKE ? OR LOWER(reference) LIKE ? OR LOWER(notes) LIKE ?)",
    );
    const like = `%${q}%`;
    args.push(like, like, like, like);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

  const countRes: any = await db.getAll(
    `SELECT COUNT(*) AS c FROM journal_entries ${where}`,
    args,
  );
  const totalCount = Number(rowsOf(countRes)[0]?.c ?? 0);

  const limit = isSearching ? 10000 : pageSize;
  const offset = isSearching ? 0 : page * pageSize;
  const entryRes: any = await db.getAll(
    `SELECT * FROM journal_entries ${where}
     ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...args, limit, offset],
  );
  const entries = rowsOf(entryRes);
  if (entries.length === 0) return { entries: [], totalCount };

  const ids = entries.map((e) => e.id);
  const ph = ids.map(() => "?").join(",");
  const linesRes: any = await db.getAll(
    `SELECT l.*, a.account_code, a.account_name
     FROM journal_entry_lines l
     LEFT JOIN accounts a ON a.id = l.account_id
     WHERE l.journal_entry_id IN (${ph})`,
    ids,
  );
  const linesByEntry = new Map<string, any[]>();
  for (const l of rowsOf(linesRes)) {
    const list = linesByEntry.get(l.journal_entry_id) ?? [];
    list.push({
      ...l,
      accounts: l.account_code
        ? { account_code: l.account_code, account_name: l.account_name }
        : null,
    });
    linesByEntry.set(l.journal_entry_id, list);
  }

  const merged = entries.map((e) => ({
    ...e,
    journal_entry_lines: linesByEntry.get(e.id) ?? [],
  }));
  return { entries: merged, totalCount };
}