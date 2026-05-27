/**
 * Minimal Supabase-shaped facade over PGlite via Electron IPC.
 *
 * Goal: existing app code can keep using `.from('table').select(...).eq(...)`
 * unchanged. We translate the query-builder calls into SQL and dispatch
 * through window.localDb (defined in electron/preload.cjs).
 *
 * Only the subset of the Supabase JS API actually used by the app is
 * implemented. Extend as needed.
 */

type LocalDbBridge = {
  query: (sql: string, params?: unknown[]) => Promise<{ ok: boolean; rows?: any[]; error?: { message: string } }>;
  exec: (sql: string) => Promise<{ ok: boolean; error?: { message: string } }>;
};

declare global {
  interface Window {
    localDb?: LocalDbBridge;
  }
}

export const isElectron = (): boolean =>
  typeof window !== 'undefined' && !!window.localDb;

type Filter =
  | { op: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike'; col: string; val: unknown }
  | { op: 'in'; col: string; vals: unknown[] }
  | { op: 'is'; col: string; val: null | boolean };

function quoteIdent(name: string): string {
  return '"' + name.replace(/"/g, '""') + '"';
}

function buildWhere(filters: Filter[], params: unknown[]): string {
  if (!filters.length) return '';
  const parts = filters.map((f) => {
    const col = quoteIdent(f.col);
    if (f.op === 'in') {
      if (!f.vals.length) return 'false';
      const placeholders = f.vals.map(() => `$${params.push(undefined)}`);
      f.vals.forEach((v, i) => (params[params.length - f.vals.length + i] = v));
      return `${col} IN (${placeholders.join(',')})`;
    }
    if (f.op === 'is') {
      if (f.val === null) return `${col} IS NULL`;
      return `${col} IS ${f.val ? 'TRUE' : 'FALSE'}`;
    }
    const sqlOp = { eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=', like: 'LIKE', ilike: 'ILIKE' }[f.op];
    params.push(f.val);
    return `${col} ${sqlOp} $${params.length}`;
  });
  return ' WHERE ' + parts.join(' AND ');
}

class QueryBuilder<Row = any> implements PromiseLike<{ data: any; error: any }> {
  private filters: Filter[] = [];
  private orderClauses: { col: string; asc: boolean }[] = [];
  private limitN?: number;
  private rangeFrom?: number;
  private rangeTo?: number;
  private singleMode: 'none' | 'single' | 'maybeSingle' = 'none';

  constructor(
    private table: string,
    private mode: 'select' | 'insert' | 'update' | 'delete' | 'upsert',
    private columns: string = '*',
    private payload?: any,
    private upsertOpts?: { onConflict?: string },
  ) {}

  // --- filter chain ---
  eq(col: string, val: unknown) { this.filters.push({ op: 'eq', col, val }); return this; }
  neq(col: string, val: unknown) { this.filters.push({ op: 'neq', col, val }); return this; }
  gt(col: string, val: unknown) { this.filters.push({ op: 'gt', col, val }); return this; }
  gte(col: string, val: unknown) { this.filters.push({ op: 'gte', col, val }); return this; }
  lt(col: string, val: unknown) { this.filters.push({ op: 'lt', col, val }); return this; }
  lte(col: string, val: unknown) { this.filters.push({ op: 'lte', col, val }); return this; }
  like(col: string, val: string) { this.filters.push({ op: 'like', col, val }); return this; }
  ilike(col: string, val: string) { this.filters.push({ op: 'ilike', col, val }); return this; }
  in(col: string, vals: unknown[]) { this.filters.push({ op: 'in', col, vals }); return this; }
  is(col: string, val: null | boolean) { this.filters.push({ op: 'is', col, val }); return this; }
  order(col: string, opts?: { ascending?: boolean }) {
    this.orderClauses.push({ col, asc: opts?.ascending !== false });
    return this;
  }
  limit(n: number) { this.limitN = n; return this; }
  range(from: number, to: number) { this.rangeFrom = from; this.rangeTo = to; return this; }
  single() { this.singleMode = 'single'; return this; }
  maybeSingle() { this.singleMode = 'maybeSingle'; return this; }
  select(columns: string = '*') {
    // Used as terminator on insert/update/delete to return rows.
    this.columns = columns;
    return this;
  }

  private buildSql(): { sql: string; params: unknown[] } {
    const params: unknown[] = [];
    const tbl = quoteIdent(this.table);

    if (this.mode === 'select') {
      let sql = `SELECT ${this.columns === '*' ? '*' : this.columns} FROM ${tbl}`;
      sql += buildWhere(this.filters, params);
      if (this.orderClauses.length) {
        sql += ' ORDER BY ' + this.orderClauses
          .map((o) => `${quoteIdent(o.col)} ${o.asc ? 'ASC' : 'DESC'}`).join(', ');
      }
      if (this.rangeFrom !== undefined && this.rangeTo !== undefined) {
        sql += ` LIMIT ${this.rangeTo - this.rangeFrom + 1} OFFSET ${this.rangeFrom}`;
      } else if (this.limitN !== undefined) {
        sql += ` LIMIT ${this.limitN}`;
      }
      return { sql, params };
    }

    if (this.mode === 'insert' || this.mode === 'upsert') {
      const rows = Array.isArray(this.payload) ? this.payload : [this.payload];
      if (!rows.length) return { sql: 'SELECT 1 WHERE FALSE', params };
      const cols = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
      const values = rows.map((r) => {
        const phs = cols.map((c) => {
          params.push(r[c] ?? null);
          return `$${params.length}`;
        });
        return `(${phs.join(',')})`;
      });
      let sql = `INSERT INTO ${tbl} (${cols.map(quoteIdent).join(',')}) VALUES ${values.join(',')}`;
      if (this.mode === 'upsert' && this.upsertOpts?.onConflict) {
        const conflictCols = this.upsertOpts.onConflict.split(',').map((c) => quoteIdent(c.trim()));
        const updates = cols.filter((c) => !this.upsertOpts!.onConflict!.split(',').map(s => s.trim()).includes(c))
          .map((c) => `${quoteIdent(c)}=EXCLUDED.${quoteIdent(c)}`);
        sql += ` ON CONFLICT (${conflictCols.join(',')}) DO UPDATE SET ${updates.join(',')}`;
      } else if (this.mode === 'upsert') {
        sql += ` ON CONFLICT DO NOTHING`;
      }
      sql += ` RETURNING ${this.columns}`;
      return { sql, params };
    }

    if (this.mode === 'update') {
      const cols = Object.keys(this.payload ?? {});
      const sets = cols.map((c) => {
        params.push((this.payload as any)[c]);
        return `${quoteIdent(c)}=$${params.length}`;
      });
      let sql = `UPDATE ${tbl} SET ${sets.join(',')}`;
      sql += buildWhere(this.filters, params);
      sql += ` RETURNING ${this.columns}`;
      return { sql, params };
    }

    if (this.mode === 'delete') {
      let sql = `DELETE FROM ${tbl}`;
      sql += buildWhere(this.filters, params);
      sql += ` RETURNING ${this.columns}`;
      return { sql, params };
    }

    throw new Error(`Unsupported mode ${this.mode}`);
  }

  async then<TResult1 = { data: any; error: any }, TResult2 = never>(
    onfulfilled?: ((value: { data: any; error: any }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    const result = await this.execute();
    return Promise.resolve(result).then(onfulfilled as any, onrejected as any);
  }

  private async execute(): Promise<{ data: any; error: any }> {
    if (!window.localDb) return { data: null, error: new Error('localDb bridge not available') };
    const { sql, params } = this.buildSql();
    const res = await window.localDb.query(sql, params);
    if (!res.ok) return { data: null, error: new Error(res.error?.message ?? 'Unknown DB error') };
    let data: any = res.rows ?? [];
    if (this.singleMode === 'single') {
      if (data.length !== 1) {
        return { data: null, error: new Error(`Expected single row, got ${data.length}`) };
      }
      data = data[0];
    } else if (this.singleMode === 'maybeSingle') {
      data = data[0] ?? null;
    }
    return { data, error: null };
  }
}

function tableApi(table: string) {
  return {
    select: (columns = '*') => new QueryBuilder(table, 'select', columns),
    insert: (payload: any) => new QueryBuilder(table, 'insert', '*', payload),
    update: (payload: any) => new QueryBuilder(table, 'update', '*', payload),
    delete: () => new QueryBuilder(table, 'delete', '*'),
    upsert: (payload: any, opts?: { onConflict?: string }) =>
      new QueryBuilder(table, 'upsert', '*', payload, opts),
  };
}

export const localDb = {
  from: tableApi,
  rpc: async (fn: string, args?: Record<string, unknown>) => {
    if (!window.localDb) return { data: null, error: new Error('localDb bridge not available') };
    const params: unknown[] = [];
    const argList = Object.entries(args ?? {}).map(([k, v]) => {
      params.push(v);
      return `${quoteIdent(k)} => $${params.length}`;
    }).join(', ');
    const sql = `SELECT * FROM ${quoteIdent(fn)}(${argList})`;
    const res = await window.localDb.query(sql, params);
    if (!res.ok) return { data: null, error: new Error(res.error?.message ?? 'rpc failed') };
    return { data: res.rows, error: null };
  },
  // Placeholders so existing imports do not explode.
  auth: {
    getUser: async () => ({ data: { user: null }, error: null }),
    getSession: async () => ({ data: { session: null }, error: null }),
  },
  functions: {
    invoke: async (_name: string, _opts?: any) => ({
      data: null,
      error: new Error('Local edge-function dispatch not yet implemented (Phase B)'),
    }),
  },
  channel: () => ({
    on: () => ({ subscribe: () => ({ unsubscribe: () => {} }) }),
    subscribe: () => ({ unsubscribe: () => {} }),
  }),
};