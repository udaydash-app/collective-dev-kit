import {
  PowerSyncDatabase,
  WASQLiteOpenFactory,
  WASQLiteVFS,
  type PowerSyncBackendConnector,
  type AbstractPowerSyncDatabase,
  type PowerSyncCredentials,
} from "@powersync/web";
import { supabase } from "@/integrations/supabase/client";
import { AppSchema } from "./schema";

class SupabaseBackendConnector implements PowerSyncBackendConnector {
  async fetchCredentials(): Promise<PowerSyncCredentials> {
    const { data, error } = await supabase.functions.invoke("powersync-credentials");
    if (error) throw error;
    if (!data?.endpoint || !data?.token) {
      throw new Error("PowerSync credentials missing endpoint/token");
    }
    return { endpoint: data.endpoint, token: data.token };
  }

  // Stub: uploads queued writes to Supabase. We'll fill this in per-table
  // as each vertical slice migrates from direct supabase.from() calls.
  async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
    const transaction = await database.getNextCrudTransaction();
    if (!transaction) return;
    try {
      for (const op of transaction.crud) {
        const table = (supabase as any).from(op.table);
        const record = { ...op.opData, id: op.id };
        if (op.op === "PUT") {
          const { error } = await table.upsert(record);
          if (error) throw error;
        } else if (op.op === "PATCH") {
          const { error } = await table.update(op.opData as any).eq("id", op.id);
          if (error) throw error;
        } else if (op.op === "DELETE") {
          const { error } = await table.delete().eq("id", op.id);
          if (error) throw error;
        }
      }
      await transaction.complete();
    } catch (err) {
      console.error("[powersync] upload failed", err);
      throw err;
    }
  }
}

let _db: PowerSyncDatabase | null = null;

export function getPowerSyncDB(): PowerSyncDatabase {
  if (_db) return _db;
  _db = new PowerSyncDatabase({
    schema: AppSchema,
    database: new WASQLiteOpenFactory({
      dbFilename: "global-market.db",
      vfs: WASQLiteVFS.IDBBatchAtomicVFS,
    }),
  });
  return _db;
}

export async function connectPowerSync(): Promise<PowerSyncDatabase> {
  const db = getPowerSyncDB();
  console.log("[powersync] init starting");
  await db.init();
  console.log("[powersync] init done, connecting");
  await db.connect(new SupabaseBackendConnector());
  console.log("[powersync] connect returned");
  return db;
}