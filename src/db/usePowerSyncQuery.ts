import { useEffect, useState } from "react";
import { connectPowerSync } from "./powersync";

/**
 * Live SQL query against the local PowerSync (WASQLite) database.
 * Re-runs automatically whenever any of the referenced tables change.
 *
 * Reads only — writes still go through supabase.from(...) for now.
 * Once a slice is fully migrated, switch its writes to db.execute(...)
 * so the PowerSync upload queue handles offline replication.
 */
export function usePowerSyncQuery<T = any>(
  sql: string,
  params: any[] = [],
): { rows: T[]; ready: boolean; error: Error | null } {
  const [rows, setRows] = useState<T[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const abort = new AbortController();
    let cancelled = false;
    (async () => {
      try {
        const db = await connectPowerSync();
        if (cancelled) return;
        db.watch(
          sql,
          params,
          {
            onResult: (result) => {
              if (cancelled) return;
              setRows(((result.rows?._array ?? []) as T[]));
              setReady(true);
            },
            onError: (e) => !cancelled && setError(e as Error),
          },
          { signal: abort.signal },
        );
      } catch (e: any) {
        if (!cancelled) setError(e);
      }
    })();
    return () => {
      cancelled = true;
      abort.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sql, JSON.stringify(params)]);

  return { rows, ready, error };
}