import { connectPowerSync } from "@/db/powersync";

// Local-first reads for offer/production/quotation modules. Reads from
// the PowerSync SQLite mirror so the pages open instantly and work
// offline. Writes still go through Supabase and stream back via
// PowerSync replication.

type Row = Record<string, any>;
const rowsOf = (res: any): Row[] =>
  Array.isArray(res) ? res : (res?.rows?._array ?? []);
const toBool = (v: any) => v === 1 || v === true;
const parseItems = (s: any): any[] => {
  if (!s) return [];
  if (Array.isArray(s)) return s;
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};

export async function fetchOffersLocal(): Promise<any[]> {
  const db = await connectPowerSync();
  const res: any = await db.getAll(
    `SELECT * FROM offers ORDER BY display_order ASC`,
  );
  return rowsOf(res).map((r) => ({ ...r, is_active: toBool(r.is_active) }));
}

export async function fetchSpecialOffersLocal(): Promise<any[]> {
  const db = await connectPowerSync();
  const res: any = await db.getAll(
    `SELECT * FROM special_offers ORDER BY created_at DESC`,
  );
  return rowsOf(res).map((r) => ({ ...r, is_active: toBool(r.is_active) }));
}

export async function fetchBogoOffersLocal(): Promise<any[]> {
  const db = await connectPowerSync();
  const res: any = await db.getAll(
    `SELECT * FROM bogo_offers ORDER BY display_order ASC`,
  );
  return rowsOf(res).map((r) => ({ ...r, is_active: toBool(r.is_active) }));
}

export async function fetchProductionsLocal(): Promise<any[]> {
  const db = await connectPowerSync();
  const prodRes: any = await db.getAll(
    `SELECT * FROM productions ORDER BY created_at DESC`,
  );
  const prods = rowsOf(prodRes);
  if (prods.length === 0) return [];
  const ids = prods.map((p) => p.id);
  const ph = ids.map(() => "?").join(",");
  const outRes: any = await db.getAll(
    `SELECT * FROM production_outputs WHERE production_id IN (${ph})`,
    ids,
  );
  const byProd = new Map<string, any[]>();
  for (const o of rowsOf(outRes)) {
    const list = byProd.get(o.production_id) ?? [];
    list.push(o);
    byProd.set(o.production_id, list);
  }
  return prods.map((p) => ({
    ...p,
    production_outputs: byProd.get(p.id) ?? [],
  }));
}

export async function fetchQuotationsLocal(): Promise<any[]> {
  const db = await connectPowerSync();
  const res: any = await db.getAll(
    `SELECT q.*, c.phone AS contact_phone, c.email AS contact_email
     FROM quotations q
     LEFT JOIN contacts c ON c.id = q.contact_id
     ORDER BY q.created_at DESC`,
  );
  return rowsOf(res).map((q: any) => ({
    ...q,
    items: parseItems(q.items),
    customer_phone: q.customer_phone || q.contact_phone || null,
    customer_email: q.customer_email || q.contact_email || null,
    contacts: q.contact_phone || q.contact_email
      ? { phone: q.contact_phone, email: q.contact_email }
      : null,
  }));
}