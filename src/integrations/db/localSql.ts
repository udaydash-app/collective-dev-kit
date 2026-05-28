export const isElectronLocalDb = () =>
  typeof window !== 'undefined' && Boolean(window.electron?.isElectron && window.localDb);

export async function localRows<T = any>(sql: string, params: unknown[] = []): Promise<T[]> {
  if (!window.localDb) throw new Error('Local database is not available');
  const result = await window.localDb.query(sql, params);
  if (!result.ok) throw new Error(result.error?.message || 'Local database query failed');
  return (result.rows ?? []) as T[];
}

export async function localMaybeSingle<T = any>(sql: string, params: unknown[] = []): Promise<T | null> {
  const rows = await localRows<T>(sql, params);
  return rows[0] ?? null;
}