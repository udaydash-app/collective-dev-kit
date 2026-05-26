import { connectPowerSync } from "@/db/powersync";

type Row = Record<string, any>;
const rowsOf = (res: any): Row[] =>
  Array.isArray(res) ? res : (res?.rows?._array ?? []);

/**
 * Local-first read for the PurchaseOrders page. Returns purchase_orders
 * with their items + minimal product/variant info, mirroring the shape
 * the page expects from Supabase.
 */
export async function fetchPurchaseOrdersLocal(searchTerm?: string): Promise<any[]> {
  const db = await connectPowerSync();

  const params: any[] = [];
  let where = "";
  if (searchTerm && searchTerm.trim()) {
    where = "WHERE po_number LIKE ? OR supplier_name LIKE ?";
    const like = `%${searchTerm.trim()}%`;
    params.push(like, like);
  }

  const poRes: any = await db.getAll(
    `SELECT * FROM purchase_orders ${where} ORDER BY created_at DESC`,
    params,
  );
  const pos = rowsOf(poRes);
  if (pos.length === 0) return [];

  const ids = pos.map((p) => p.id);
  const placeholders = ids.map(() => "?").join(",");
  const itemsRes: any = await db.getAll(
    `SELECT poi.*,
            p.name AS product_name_fk, p.image_url AS product_image_url,
            v.label AS variant_label_fk
     FROM purchase_order_items poi
     LEFT JOIN products p ON p.id = poi.product_id
     LEFT JOIN product_variants v ON v.id = poi.variant_id
     WHERE poi.purchase_order_id IN (${placeholders})`,
    ids,
  );
  const itemsByPo = new Map<string, any[]>();
  for (const it of rowsOf(itemsRes)) {
    const shaped = {
      ...it,
      products: it.product_id
        ? { name: it.product_name_fk, image_url: it.product_image_url }
        : null,
      product_variants: it.variant_id ? { label: it.variant_label_fk } : null,
    };
    const arr = itemsByPo.get(it.purchase_order_id) ?? [];
    arr.push(shaped);
    itemsByPo.set(it.purchase_order_id, arr);
  }

  return pos.map((po) => ({
    ...po,
    purchase_order_items: itemsByPo.get(po.id) ?? [],
  }));
}