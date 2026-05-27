import { connectPowerSync } from "@/db/powersync";
import { supabase } from "@/integrations/supabase/client";

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
  const local = rowsOf(res);
  if (local.length === 0 && navigator.onLine) {
    try {
      let q = supabase.from("accounts").select("*").order("account_code");
      if (!opts.includeInactive) q = q.eq("is_active", true);
      const { data, error } = await q;
      if (!error && data) return data as any[];
    } catch (e) {
      console.warn("[accounts] Supabase fallback failed", e);
    }
  }
  return local.map((r) => ({ ...r, is_active: toBool(r.is_active) }) as any);
}

// Compute debit/credit totals per account from posted journal entry lines
// up to (and optionally from) a given date. Returns one row per active
// account. Used by Trial Balance, Balance Sheet, and P&L expense sections.
export async function fetchAccountBalancesLocal(opts: {
  startDate?: string;
  endDate?: string;
  accountTypes?: string[];
} = {}): Promise<any[]> {
  const db = await connectPowerSync();
  const typeFilter = opts.accountTypes && opts.accountTypes.length
    ? `AND a.account_type IN (${opts.accountTypes.map(() => '?').join(',')})`
    : '';
  const args: any[] = [];
  if (opts.accountTypes?.length) args.push(...opts.accountTypes);

  const lineDateClauses: string[] = ["e.status = 'posted'"];
  if (opts.startDate) lineDateClauses.push("e.entry_date >= ?");
  if (opts.endDate) lineDateClauses.push("e.entry_date <= ?");
  const lineArgs: any[] = [];
  if (opts.startDate) lineArgs.push(opts.startDate);
  if (opts.endDate) lineArgs.push(opts.endDate);

  const sql = `
    SELECT a.*, 
           COALESCE(SUM(l.debit_amount), 0)  AS total_debit,
           COALESCE(SUM(l.credit_amount), 0) AS total_credit
    FROM accounts a
    LEFT JOIN journal_entry_lines l ON l.account_id = a.id
    LEFT JOIN journal_entries e ON e.id = l.journal_entry_id
      AND ${lineDateClauses.join(' AND ')}
    WHERE a.is_active = 1 ${typeFilter}
    GROUP BY a.id
    ORDER BY a.account_code
  `;
  const res: any = await db.getAll(sql, [...lineArgs, ...args]);
  return rowsOf(res).map((r: any) => ({
    ...r,
    is_active: toBool(r.is_active),
    total_debit: Number(r.total_debit) || 0,
    total_credit: Number(r.total_credit) || 0,
  }));
}

// Raw inputs needed for the Profit & Loss report. Reads purchases,
// pos_transactions, products, product_variants, and stock_adjustments
// from the local PowerSync mirror so the page works offline.
export async function fetchProfitLossInputsLocal(startDate: string, endDate: string) {
  const db = await connectPowerSync();
  const endTs = `${endDate}T23:59:59`;

  const [
    purchasesRes,
    salesRes,
    futurePurchasesRes,
    futureSalesRes,
    productsRes,
    variantsRes,
    stockAdjRes,
    futureAdjRes,
  ] = await Promise.all([
    db.getAll(
      `SELECT total_amount FROM purchases WHERE purchased_at >= ? AND purchased_at <= ?`,
      [startDate, endTs],
    ),
    db.getAll(
      `SELECT subtotal, discount, items FROM pos_transactions
       WHERE created_at >= ? AND created_at <= ?`,
      [startDate, endTs],
    ),
    db.getAll(
      `SELECT total_amount FROM purchases WHERE purchased_at > ?`,
      [endTs],
    ),
    db.getAll(
      `SELECT items FROM pos_transactions WHERE created_at > ?`,
      [endTs],
    ),
    db.getAll(`SELECT id, cost_price, stock_quantity FROM products`),
    db.getAll(`SELECT id, cost_price, stock_quantity, product_id FROM product_variants`),
    db.getAll(
      `SELECT quantity_change, product_id, variant_id, unit_cost, total_value
       FROM stock_adjustments WHERE created_at >= ? AND created_at <= ?`,
      [startDate, endTs],
    ),
    db.getAll(
      `SELECT quantity_change, product_id, variant_id FROM stock_adjustments
       WHERE created_at > ?`,
      [endTs],
    ),
  ]);

  const parseItems = (rows: any[]) =>
    rowsOf(rows).map((r: any) => ({
      ...r,
      items: typeof r.items === 'string' ? safeJson(r.items) : r.items,
    }));

  return {
    purchases: rowsOf(purchasesRes),
    sales: parseItems(salesRes as any),
    futurePurchases: rowsOf(futurePurchasesRes),
    futureSales: parseItems(futureSalesRes as any),
    allProducts: rowsOf(productsRes),
    allVariants: rowsOf(variantsRes),
    stockAdjustments: rowsOf(stockAdjRes),
    futureAdjustments: rowsOf(futureAdjRes),
  };
}

function safeJson(s: any): any[] {
  if (!s) return [];
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
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
  const local = rowsOf(res);
  if (local.length === 0 && navigator.onLine) {
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('store_id', storeId)
        .order('expense_date', { ascending: false })
        .order('created_at', { ascending: false });
      if (!error && data) return data as any[];
    } catch (e) {
      console.warn('[expenses] Supabase fallback failed', e);
    }
  }
  return local;
}

export async function fetchActiveStoresLocal(): Promise<any[]> {
  const db = await connectPowerSync();
  const res: any = await db.getAll(
    `SELECT id, name FROM stores WHERE is_active = 1 ORDER BY name`,
  );
  return rowsOf(res);
}

// ----- Modern Dashboard local-first read --------------------------------
// Returns the exact shape DashboardModern.tsx expects from its RPC /
// direct-query path: pos_transactions/orders/pos_users/purchases/expenses/
// journal_entries/accounts + counts.products/contacts/lowStock.
export async function fetchModernDashboardLocal(since: string) {
  const db = await connectPowerSync();
  const [
    txRes,
    ordersRes,
    posUsersRes,
    purchasesRes,
    expensesRes,
    journalsRes,
    accountsRes,
    prodCountRes,
    contactCountRes,
    lowStockRes,
  ] = await Promise.all([
    db.getAll(
      `SELECT id, transaction_number, total, subtotal, discount, tax,
              payment_method, created_at, items, cashier_id
       FROM pos_transactions WHERE created_at >= ?
       ORDER BY created_at DESC LIMIT 500`,
      [since],
    ),
    db.getAll(
      `SELECT id, order_number, total, status, payment_status, created_at
       FROM orders WHERE created_at >= ?
       ORDER BY created_at DESC LIMIT 200`,
      [since],
    ),
    db.getAll(`SELECT id, full_name, is_active FROM pos_users`),
    db.getAll(
      `SELECT id, purchase_number, supplier_name, total_amount, created_at
       FROM purchases WHERE created_at >= ?
       ORDER BY created_at DESC LIMIT 50`,
      [since],
    ),
    db.getAll(
      `SELECT id, description, category, amount, expense_date, created_at
       FROM expenses WHERE created_at >= ?
       ORDER BY created_at DESC LIMIT 50`,
      [since],
    ),
    db.getAll(
      `SELECT id, entry_number, reference, description, entry_date, status, created_at
       FROM journal_entries WHERE created_at >= ?
       ORDER BY created_at DESC LIMIT 50`,
      [since],
    ),
    db.getAll(
      `SELECT id, account_code, account_name, account_type, current_balance
       FROM accounts WHERE is_active = 1
       ORDER BY account_code ASC LIMIT 500`,
    ),
    db.getAll(`SELECT COUNT(*) AS c FROM products`),
    db.getAll(`SELECT COUNT(*) AS c FROM contacts`),
    db.getAll(`SELECT COUNT(*) AS c FROM products WHERE stock_quantity <= 5`),
  ]);

  const parseItems = (rows: any[]) =>
    rowsOf(rows).map((r: any) => ({
      ...r,
      items: typeof r.items === 'string' ? safeJson(r.items) : (r.items ?? []),
    }));

  return {
    pos_transactions: parseItems(txRes as any),
    orders: rowsOf(ordersRes),
    pos_users: rowsOf(posUsersRes).map((r) => ({ ...r, is_active: toBool(r.is_active) })),
    purchases: rowsOf(purchasesRes),
    expenses: rowsOf(expensesRes),
    journal_entries: rowsOf(journalsRes),
    accounts: rowsOf(accountsRes),
    counts: {
      products: Number(rowsOf(prodCountRes)[0]?.c ?? 0),
      contacts: Number(rowsOf(contactCountRes)[0]?.c ?? 0),
      lowStock: Number(rowsOf(lowStockRes)[0]?.c ?? 0),
    },
  };
}

// Quick cost/price lookup by ids — used by ProfitLoss, Quotations, etc.
export async function fetchProductPricesLocal(
  productIds: string[],
  fields: string[] = ['id', 'cost_price'],
): Promise<any[]> {
  if (productIds.length === 0) return [];
  const db = await connectPowerSync();
  const ph = productIds.map(() => '?').join(',');
  const res: any = await db.getAll(
    `SELECT ${fields.join(', ')} FROM products WHERE id IN (${ph})`,
    productIds,
  );
  return rowsOf(res);
}

export async function fetchVariantPricesLocal(
  variantIds: string[],
  fields: string[] = ['id', 'cost_price'],
): Promise<any[]> {
  if (variantIds.length === 0) return [];
  const db = await connectPowerSync();
  const ph = variantIds.map(() => '?').join(',');
  const res: any = await db.getAll(
    `SELECT ${fields.join(', ')} FROM product_variants WHERE id IN (${ph})`,
    variantIds,
  );
  return rowsOf(res);
}

export async function fetchSuppliersLocal(): Promise<any[]> {
  const db = await connectPowerSync();
  const res: any = await db.getAll(
    `SELECT id, name, phone, email FROM contacts
     WHERE is_supplier = 1 ORDER BY name`,
  );
  return rowsOf(res);
}

export async function fetchPurchasesLocal(): Promise<any[]> {
  const db = await connectPowerSync();
  const pRes: any = await db.getAll(
    `SELECT p.*, s.name AS store_name
     FROM purchases p LEFT JOIN stores s ON s.id = p.store_id
     ORDER BY p.created_at DESC`,
  );
  const purchases = rowsOf(pRes);
  if (purchases.length === 0) return [];

  const ids = purchases.map((p) => p.id);
  const ph = ids.map(() => "?").join(",");
  const iRes: any = await db.getAll(
    `SELECT pi.*, pr.name AS product_name,
            v.label AS variant_label, v.quantity AS variant_quantity, v.unit AS variant_unit
     FROM purchase_items pi
     LEFT JOIN products pr ON pr.id = pi.product_id
     LEFT JOIN product_variants v ON v.id = pi.variant_id
     WHERE pi.purchase_id IN (${ph})`,
    ids,
  );
  const byPurchase = new Map<string, any[]>();
  for (const it of rowsOf(iRes)) {
    const list = byPurchase.get(it.purchase_id) ?? [];
    list.push({
      ...it,
      products: it.product_name ? { id: it.product_id, name: it.product_name } : null,
      product_variants: it.variant_label
        ? { id: it.variant_id, label: it.variant_label, quantity: it.variant_quantity, unit: it.variant_unit }
        : null,
    });
    byPurchase.set(it.purchase_id, list);
  }
  return purchases.map((p) => ({
    ...p,
    stores: p.store_name ? { name: p.store_name } : null,
    purchase_items: byPurchase.get(p.id) ?? [],
  }));
}

// Build unified receivables/payables list from local contacts + accounts.
// Matches existing logic in AccountsReceivable/Payable pages (uses
// accounts.current_balance as the source of truth).
export async function fetchReceivablesLocal(): Promise<any[]> {
  const db = await connectPowerSync();
  const cRes: any = await db.getAll(
    `SELECT id, name, phone, email, credit_limit, is_customer, is_supplier,
            customer_ledger_account_id, supplier_ledger_account_id
     FROM contacts WHERE is_customer = 1 ORDER BY name`,
  );
  const contacts = rowsOf(cRes);
  const ids = contacts
    .flatMap((c) => [c.customer_ledger_account_id, c.supplier_ledger_account_id])
    .filter(Boolean);
  const balances = await loadBalancesLocal(db, ids);
  return contacts
    .map((c) => {
      let bal = balances.get(c.customer_ledger_account_id) ?? 0;
      if (toBool(c.is_supplier) && c.supplier_ledger_account_id) {
        bal -= balances.get(c.supplier_ledger_account_id) ?? 0;
      }
      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email,
        credit_limit: c.credit_limit || 0,
        balance: bal,
        isUnified: toBool(c.is_supplier),
      };
    })
    .filter((c) => c.balance !== 0);
}

export async function fetchPayablesLocal(): Promise<any[]> {
  const db = await connectPowerSync();
  const cRes: any = await db.getAll(
    `SELECT id, name, phone, email, is_customer, is_supplier,
            customer_ledger_account_id, supplier_ledger_account_id
     FROM contacts WHERE is_supplier = 1 ORDER BY name`,
  );
  const contacts = rowsOf(cRes);
  const ids = contacts
    .flatMap((c) => [c.customer_ledger_account_id, c.supplier_ledger_account_id])
    .filter(Boolean);
  const balances = await loadBalancesLocal(db, ids);
  return contacts
    .map((c) => {
      let bal = balances.get(c.supplier_ledger_account_id) ?? 0;
      if (toBool(c.is_customer) && c.customer_ledger_account_id) {
        bal -= balances.get(c.customer_ledger_account_id) ?? 0;
      }
      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email,
        balance: bal,
        isUnified: toBool(c.is_customer),
      };
    })
    .filter((c) => c.balance > 0);
}

async function loadBalancesLocal(db: any, ids: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (ids.length === 0) return map;
  const unique = Array.from(new Set(ids));
  const ph = unique.map(() => "?").join(",");
  // Authoritative balance: opening_balance + sum(debits - credits) from
  // POSTED journal entry lines. accounts.current_balance is a cached
  // value and can drift, so we never rely on it for AR/AP totals.
  const accRes: any = await db.getAll(
    `SELECT id, opening_balance, account_type
     FROM accounts WHERE id IN (${ph})`,
    unique,
  );
  const linesRes: any = await db.getAll(
    `SELECT l.account_id,
            COALESCE(SUM(l.debit_amount), 0)  AS d,
            COALESCE(SUM(l.credit_amount), 0) AS c
     FROM journal_entry_lines l
     JOIN journal_entries e ON e.id = l.journal_entry_id
     WHERE l.account_id IN (${ph}) AND e.status = 'posted'
     GROUP BY l.account_id`,
    unique,
  );
  const movement = new Map<string, number>();
  for (const r of rowsOf(linesRes)) {
    movement.set(r.account_id, (Number(r.d) || 0) - (Number(r.c) || 0));
  }
  for (const a of rowsOf(accRes)) {
    const opening = Number(a.opening_balance) || 0;
    const delta = movement.get(a.id) ?? 0;
    // For asset/expense accounts a debit balance is positive; for
    // liability/equity/revenue a credit balance is positive. The 411x
    // (asset) and 401x (liability) ledgers follow this convention, so
    // we flip sign for non-debit-normal account types.
    const debitNormal = a.account_type === 'asset' || a.account_type === 'expense';
    map.set(a.id, debitNormal ? opening + delta : opening - delta);
  }
  return map;
}

export interface LocalJournalFilter {
  start?: Date | null;
  end?: Date | null;
  searchQuery?: string;
  page?: number;
  pageSize?: number;
}

// --- Per-account ledger helpers (local-first) -----------------------------

export async function fetchAccountByIdLocal(accountId: string): Promise<any | null> {
  if (!accountId) return null;
  const db = await connectPowerSync();
  const res: any = await db.getAll(
    `SELECT * FROM accounts WHERE id = ? LIMIT 1`,
    [accountId],
  );
  const row = rowsOf(res)[0];
  return row ? { ...row, is_active: toBool(row.is_active) } : null;
}

export async function fetchContactByLedgerAccountLocal(accountId: string): Promise<any | null> {
  if (!accountId) return null;
  const db = await connectPowerSync();
  const res: any = await db.getAll(
    `SELECT opening_balance, supplier_opening_balance,
            customer_ledger_account_id, supplier_ledger_account_id,
            is_customer, is_supplier
     FROM contacts
     WHERE customer_ledger_account_id = ? OR supplier_ledger_account_id = ?
     LIMIT 1`,
    [accountId, accountId],
  );
  const row = rowsOf(res)[0];
  if (!row) return null;
  return {
    ...row,
    is_customer: toBool(row.is_customer),
    is_supplier: toBool(row.is_supplier),
  };
}

// Fetch journal entry lines for an account within an optional date range,
// excluding "opening balance" entries and only including posted entries.
// Joins journal_entries so the page can read entry_date/description/etc.
export async function fetchAccountLinesLocal(
  accountId: string,
  opts: { startDate?: string; endDate?: string; includePrior?: boolean } = {},
): Promise<any[]> {
  if (!accountId) return [];
  const db = await connectPowerSync();
  const clauses: string[] = [
    "l.account_id = ?",
    "e.status = 'posted'",
    "LOWER(COALESCE(e.description, '')) NOT LIKE '%opening balance%'",
  ];
  const args: any[] = [accountId];
  if (opts.startDate && !opts.includePrior) {
    clauses.push("e.entry_date >= ?");
    args.push(opts.startDate);
  }
  if (opts.endDate) {
    clauses.push("e.entry_date <= ?");
    args.push(opts.endDate);
  }
  const res: any = await db.getAll(
    `SELECT l.*, e.entry_number, e.entry_date, e.description AS je_description,
            e.reference, e.notes AS je_notes, e.status
     FROM journal_entry_lines l
     INNER JOIN journal_entries e ON e.id = l.journal_entry_id
     WHERE ${clauses.join(' AND ')}`,
    args,
  );
  return rowsOf(res).map((r: any) => ({
    ...r,
    journal_entries: {
      entry_number: r.entry_number,
      entry_date: r.entry_date,
      description: r.je_description,
      reference: r.reference,
      notes: r.je_notes,
      status: r.status,
    },
  }));
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