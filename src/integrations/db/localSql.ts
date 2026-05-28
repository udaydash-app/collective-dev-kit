export const isElectronLocalDb = () =>
  typeof window !== 'undefined' && Boolean(window.electron?.isElectron && window.localDb);

function quoteIdent(name: string): string {
  return '"' + name.replace(/"/g, '""') + '"';
}

function toPostgresSql(sql: string): string {
  let index = 0;
  return sql
    .replace(/LIKE\s+\?\s+COLLATE\s+NOCASE/gi, 'ILIKE ?')
    .replace(/\b(is_active|is_available|is_available_online|is_featured|is_default|is_customer|is_supplier)\s*=\s*1\b/g, '$1 = TRUE')
    .replace(/\b(is_active|is_available|is_available_online|is_featured|is_default|is_customer|is_supplier)\s*=\s*0\b/g, '$1 = FALSE')
    .replace(/\?/g, () => `$${++index}`);
}

export async function localRows<T = any>(sql: string, params: unknown[] = []): Promise<T[]> {
  if (!window.localDb) throw new Error('Local database is not available');
  const result = await window.localDb.query(toPostgresSql(sql), params);
  if (!result.ok) throw new Error(result.error?.message || 'Local database query failed');
  return (result.rows ?? []) as T[];
}

export async function localMaybeSingle<T = any>(sql: string, params: unknown[] = []): Promise<T | null> {
  const rows = await localRows<T>(sql, params);
  return rows[0] ?? null;
}

export async function localUpsertRows(table: string, rows: Record<string, any>[], conflict = 'id') {
  if (!window.localDb || rows.length === 0) return;
  const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const conflictColumns = conflict.split(',').map((col) => col.trim());
  const params: unknown[] = [];
  const values = rows.map((row) => {
    const placeholders = columns.map((column) => {
      const value = row[column] ?? null;
      params.push(value && typeof value === 'object' ? JSON.stringify(value) : value);
      return `$${params.length}`;
    });
    return `(${placeholders.join(',')})`;
  });
  const updates = columns
    .filter((column) => !conflictColumns.includes(column))
    .map((column) => `${quoteIdent(column)} = EXCLUDED.${quoteIdent(column)}`);
  const sql = `INSERT INTO ${quoteIdent(table)} (${columns.map(quoteIdent).join(',')}) VALUES ${values.join(',')}
    ON CONFLICT (${conflictColumns.map(quoteIdent).join(',')}) DO UPDATE SET ${updates.join(',')}`;
  const result = await window.localDb.query(sql, params);
  if (!result.ok) throw new Error(result.error?.message || `Local upsert failed for ${table}`);
}