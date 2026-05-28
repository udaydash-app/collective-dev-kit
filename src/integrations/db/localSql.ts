export const isElectronLocalDb = () =>
  typeof window !== 'undefined' && Boolean(window.electron?.isElectron && window.localDb);

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