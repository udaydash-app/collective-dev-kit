import { useEffect, useState } from "react";
import { connectPowerSync, getPowerSyncDB } from "@/db/powersync";
import type { PowerSyncDatabase } from "@powersync/web";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Status = "idle" | "connecting" | "connected" | "error";

interface ProductRow {
  id: string;
  name: string | null;
  price: number | null;
  stock_quantity: number | null;
}

export default function PowerSyncTest() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [hasSynced, setHasSynced] = useState(false);
  const [db, setDb] = useState<PowerSyncDatabase | null>(null);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      setStatus("connecting");
      try {
        const instance = await connectPowerSync();
        if (cancelled) return;
        setDb(instance);
        setStatus("connected");

        const sub = instance.registerListener({
          statusChanged: (s) => {
            setHasSynced(s.hasSynced ?? false);
          },
        });
        unsub = sub;

        const abort = new AbortController();
        instance
          .watch(
            "SELECT id, name, price, stock_quantity FROM products ORDER BY name LIMIT 20",
            [],
            {
              onResult: (result) => {
                setRows((result.rows?._array ?? []) as ProductRow[]);
              },
            },
            { signal: abort.signal },
          )
          .catch(() => {});
        const prevUnsub = unsub;
        unsub = () => {
          abort.abort();
          prevUnsub?.();
        };
      } catch (e: any) {
        console.error("[powersync-test] connect failed", e);
        setError(e?.message ?? String(e));
        setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  return (
    <div className="container mx-auto p-6 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>PowerSync Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p>
            Status: <strong>{status}</strong>
            {hasSynced ? " · initial sync complete" : " · waiting for first sync"}
          </p>
          {error && (
            <p className="text-destructive text-sm break-all">Error: {error}</p>
          )}
          <p className="text-sm text-muted-foreground">
            Local rows in products collection: {rows.length}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              const instance = db ?? getPowerSyncDB();
              await instance.disconnectAndClear();
              window.location.reload();
            }}
          >
            Reset local DB
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>First 20 products (live)</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {rows.map((r) => (
              <li key={r.id} className="py-2 flex justify-between text-sm">
                <span>{r.name ?? "(no name)"}</span>
                <span className="text-muted-foreground">
                  stock {r.stock_quantity ?? 0} · {r.price ?? 0}
                </span>
              </li>
            ))}
            {rows.length === 0 && (
              <li className="py-2 text-sm text-muted-foreground">No rows yet.</li>
            )}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}