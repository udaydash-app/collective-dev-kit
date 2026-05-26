import { connectPowerSync } from "@/db/powersync";

// Reactive-ish helpers that read products/categories/stores/suppliers
// from the local PowerSync SQLite database. JOINs are executed locally,
// so reads are instant and work offline. Writes still go through Supabase
// and stream back via PowerSync replication.

type Row = Record<string, any>;

const toBool = (v: any) => v === 1 || v === true;

function parseVariants(json: string | null): any[] {
  if (!json) return [];
  try {
    const arr = JSON.parse(json);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((v: any) => v && v.id)
      .map((v: any) => ({
        ...v,
        is_available: toBool(v.is_available),
        is_default: toBool(v.is_default),
      }));
  } catch {
    return [];
  }
}

export async function fetchProductsLocal() {
  const db = await connectPowerSync();
  const sql = `
    SELECT
      p.id, p.name, p.description, p.price, p.cost_price, p.local_charges,
      p.wholesale_price, p.vip_price, p.unit, p.image_url, p.images, p.tags,
      p.category_id, p.store_id, p.supplier_id, p.is_available,
      p.is_available_online, p.is_featured, p.stock_quantity, p.barcode,
      p.nutritional_info, p.created_at, p.updated_at,
      c.name AS category_name,
      s.name AS store_name,
      sup.name AS supplier_name,
      (
        SELECT json_group_array(json_object(
          'id', v.id,
          'product_id', v.product_id,
          'unit', v.unit,
          'label', v.label,
          'quantity', v.quantity,
          'price', v.price,
          'cost_price', v.cost_price,
          'wholesale_price', v.wholesale_price,
          'vip_price', v.vip_price,
          'barcode', v.barcode,
          'stock_quantity', v.stock_quantity,
          'is_available', v.is_available,
          'is_default', v.is_default
        ))
        FROM product_variants v WHERE v.product_id = p.id
      ) AS variants_json
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    LEFT JOIN stores s ON s.id = p.store_id
    LEFT JOIN contacts sup ON sup.id = p.supplier_id
    ORDER BY p.created_at DESC
  `;
  const result: any = await db.getAll(sql);
  const rows: Row[] = Array.isArray(result) ? result : (result?.rows?._array ?? []);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    price: r.price ?? 0,
    cost_price: r.cost_price ?? undefined,
    local_charges: r.local_charges ?? undefined,
    wholesale_price: r.wholesale_price ?? undefined,
    vip_price: r.vip_price ?? undefined,
    unit: r.unit ?? "pcs",
    image_url: r.image_url,
    category_id: r.category_id,
    store_id: r.store_id,
    supplier_id: r.supplier_id,
    is_available: toBool(r.is_available),
    is_available_online: toBool(r.is_available_online),
    is_featured: toBool(r.is_featured),
    stock_quantity: r.stock_quantity ?? 0,
    barcode: r.barcode,
    categories: r.category_name ? { name: r.category_name } : undefined,
    stores: r.store_name ? { name: r.store_name } : undefined,
    contacts: r.supplier_name ? { name: r.supplier_name } : undefined,
    product_variants: parseVariants(r.variants_json),
  }));
}

export async function fetchCategoriesLocal() {
  const db = await connectPowerSync();
  const result: any = await db.getAll(
    `SELECT id, name FROM categories WHERE is_active = 1 ORDER BY name`,
  );
  const rows: Row[] = Array.isArray(result) ? result : (result?.rows?._array ?? []);
  return rows.map((r) => ({ id: r.id, name: r.name }));
}

export async function fetchStoresLocal() {
  const db = await connectPowerSync();
  const result: any = await db.getAll(
    `SELECT id, name FROM stores WHERE is_active = 1 ORDER BY name`,
  );
  const rows: Row[] = Array.isArray(result) ? result : (result?.rows?._array ?? []);
  return rows.map((r) => ({ id: r.id, name: r.name }));
}

export async function fetchSuppliersLocal() {
  const db = await connectPowerSync();
  const result: any = await db.getAll(
    `SELECT id, name FROM contacts WHERE is_supplier = 1 ORDER BY name`,
  );
  const rows: Row[] = Array.isArray(result) ? result : (result?.rows?._array ?? []);
  return rows.map((r) => ({ id: r.id, name: r.name }));
}