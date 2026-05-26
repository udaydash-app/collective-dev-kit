import { connectPowerSync } from "@/db/powersync";

// Local-first reads for the Contacts module. Reads from the local
// PowerSync SQLite mirror so the page opens instantly and works
// offline. Writes still go through Supabase and stream back via
// PowerSync replication.

type Row = Record<string, any>;
const rowsOf = (res: any): Row[] =>
  Array.isArray(res) ? res : (res?.rows?._array ?? []);
const toBool = (v: any) => v === 1 || v === true;

export async function fetchContactsLocal(opts: {
  isCustomer?: boolean;
  isSupplier?: boolean;
} = {}): Promise<any[]> {
  const db = await connectPowerSync();
  const where: string[] = [];
  const args: any[] = [];
  if (opts.isCustomer !== undefined) {
    where.push("is_customer = ?");
    args.push(opts.isCustomer ? 1 : 0);
  }
  if (opts.isSupplier !== undefined) {
    where.push("is_supplier = ?");
    args.push(opts.isSupplier ? 1 : 0);
  }
  const sql = `SELECT * FROM contacts ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY name`;
  const res: any = await db.getAll(sql, args);
  return rowsOf(res).map((r) => ({
    ...r,
    is_customer: toBool(r.is_customer),
    is_supplier: toBool(r.is_supplier),
  }));
}