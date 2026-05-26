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
  const productsSql = `
    SELECT
      p.id, p.name, p.description, p.price, p.cost_price, p.local_charges,
      p.wholesale_price, p.vip_price, p.unit, p.image_url, p.images, p.tags,
      p.category_id, p.store_id, p.supplier_id, p.is_available,
      p.is_available_online, p.is_featured, p.stock_quantity, p.barcode,
      p.nutritional_info, p.created_at, p.updated_at,
      c.name AS category_name,
      s.name AS store_name,
      sup.name AS supplier_name
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    LEFT JOIN stores s ON s.id = p.store_id
    LEFT JOIN contacts sup ON sup.id = p.supplier_id
    ORDER BY p.created_at DESC
  `;
  const variantsSql = `
    SELECT id, product_id, unit, label, quantity, price, cost_price,
           wholesale_price, vip_price, barcode, stock_quantity,
           is_available, is_default
    FROM product_variants
  `;
  const [prodRes, varRes]: any = await Promise.all([
    db.getAll(productsSql),
    db.getAll(variantsSql),
  ]);
  const rows: Row[] = Array.isArray(prodRes) ? prodRes : (prodRes?.rows?._array ?? []);
  const vRows: Row[] = Array.isArray(varRes) ? varRes : (varRes?.rows?._array ?? []);
  const variantsByProduct = new Map<string, any[]>();
  for (const v of vRows) {
    const list = variantsByProduct.get(v.product_id) ?? [];
    list.push({
      ...v,
      is_available: toBool(v.is_available),
      is_default: toBool(v.is_default),
    });
    variantsByProduct.set(v.product_id, list);
  }
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
    product_variants: variantsByProduct.get(r.id) ?? [],
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

// Lightweight POS-shaped product (matches columns used by ProductSearch/Cart).
interface PosProduct {
  id: string;
  name: string;
  price: number;
  barcode: string | null;
  is_available: boolean;
  stock_quantity: number;
  cost_price?: number;
  product_variants: Array<{
    id: string;
    label?: string;
    quantity?: number;
    unit?: string;
    price: number;
    is_available: boolean;
    is_default: boolean;
    barcode: string | null;
    stock_quantity: number;
  }>;
}

function mapPosProducts(prodRows: Row[], varRows: Row[]): PosProduct[] {
  const variantsByProduct = new Map<string, any[]>();
  for (const v of varRows) {
    const list = variantsByProduct.get(v.product_id) ?? [];
    list.push({
      id: v.id,
      label: v.label,
      quantity: v.quantity,
      unit: v.unit,
      price: v.price ?? 0,
      is_available: toBool(v.is_available),
      is_default: toBool(v.is_default),
      barcode: v.barcode,
      stock_quantity: v.stock_quantity ?? 0,
    });
    variantsByProduct.set(v.product_id, list);
  }
  return prodRows.map((p) => ({
    id: p.id,
    name: p.name,
    price: p.price ?? 0,
    barcode: p.barcode,
    is_available: toBool(p.is_available),
    stock_quantity: p.stock_quantity ?? 0,
    cost_price: p.cost_price ?? undefined,
    product_variants: variantsByProduct.get(p.id) ?? [],
  }));
}

/**
 * Search up to `limit` available products by name or barcode (substring).
 * Reads from local PowerSync SQLite — instant and offline-capable.
 */
export async function searchPosProductsLocal(
  term: string,
  limit = 10,
): Promise<PosProduct[]> {
  const db = await connectPowerSync();
  const productRowsById = new Map<string, Row>();
  if (!term) {
    const prodRes: any = await db.getAll(
      `SELECT id, name, price, barcode, is_available, stock_quantity, cost_price
       FROM products WHERE is_available = 1 ORDER BY name LIMIT ?`,
      [limit],
    );
    const prodRows: Row[] = Array.isArray(prodRes) ? prodRes : (prodRes?.rows?._array ?? []);
    prodRows.forEach((p) => productRowsById.set(p.id, p));
  } else {
    const exact = term.trim();
    const prefix = `${exact}%`;
    const prodRes: any = await db.getAll(
      `SELECT id, name, price, barcode, is_available, stock_quantity, cost_price
       FROM products
       WHERE is_available = 1
          AND (barcode = ? OR name LIKE ? COLLATE NOCASE OR barcode LIKE ? COLLATE NOCASE)
       ORDER BY name LIMIT ?`,
      [exact, prefix, prefix, limit],
    );
    const prodRows: Row[] = Array.isArray(prodRes) ? prodRes : (prodRes?.rows?._array ?? []);
    prodRows.forEach((p) => productRowsById.set(p.id, p));

    if (productRowsById.size < limit) {
      const varMatchRes: any = await db.getAll(
        `SELECT DISTINCT p.id, p.name, p.price, p.barcode, p.is_available, p.stock_quantity, p.cost_price
         FROM product_variants v
         JOIN products p ON p.id = v.product_id
         WHERE v.is_available = 1 AND p.is_available = 1
           AND (v.barcode = ? OR v.barcode LIKE ? COLLATE NOCASE)
         ORDER BY p.name LIMIT ?`,
        [exact, prefix, limit - productRowsById.size],
      );
      const varProductRows: Row[] = Array.isArray(varMatchRes) ? varMatchRes : (varMatchRes?.rows?._array ?? []);
      varProductRows.forEach((p) => productRowsById.set(p.id, p));
    }

    if (productRowsById.size === 0) {
      const contains = `%${exact}%`;
      const fallbackRes: any = await db.getAll(
        `SELECT id, name, price, barcode, is_available, stock_quantity, cost_price
         FROM products
         WHERE is_available = 1
           AND (name LIKE ? COLLATE NOCASE OR barcode LIKE ? COLLATE NOCASE)
         ORDER BY name LIMIT ?`,
        [contains, contains, limit],
      );
      const fallbackRows: Row[] = Array.isArray(fallbackRes) ? fallbackRes : (fallbackRes?.rows?._array ?? []);
      fallbackRows.forEach((p) => productRowsById.set(p.id, p));
    }
  }
  const prodRows = Array.from(productRowsById.values()).slice(0, limit);
  if (prodRows.length === 0) return [];
  const ids = prodRows.map((p) => p.id);
  const placeholders = ids.map(() => "?").join(",");
  const varRes: any = await db.getAll(
    `SELECT id, product_id, label, quantity, unit, price, is_available,
            is_default, barcode, stock_quantity
     FROM product_variants WHERE product_id IN (${placeholders})`,
    ids,
  );
  const varRows: Row[] = Array.isArray(varRes) ? varRes : (varRes?.rows?._array ?? []);
  return mapPosProducts(prodRows, varRows);
}

/**
 * Find a single available product matching an exact barcode at the product
 * or variant level. Handles comma-separated barcodes. Returns null if none.
 */
export async function findPosProductByBarcodeLocal(
  barcode: string,
): Promise<{ product: PosProduct; variant: PosProduct["product_variants"][0] | null } | null> {
  const db = await connectPowerSync();
  const bc = barcode.trim().toLowerCase();
  const exact = barcode.trim();
  const prefix = `${exact}%`;
  // Pull only index-friendly barcode candidates first. Comma-separated legacy
  // barcodes still work when the scanned value is the first listed barcode.
  const varRes: any = await db.getAll(
    `SELECT id, product_id, label, quantity, unit, price,
            is_available, is_default, barcode, stock_quantity
     FROM product_variants
     WHERE is_available = 1 AND (barcode = ? OR barcode LIKE ? COLLATE NOCASE)
     LIMIT 20`,
    [exact, prefix],
  );
  const candidateVarRows: Row[] = Array.isArray(varRes) ? varRes : (varRes?.rows?._array ?? []);

  // Prefer exact variant match.
  const matchVar = candidateVarRows.find((v) => {
    if (!v.barcode) return false;
    return v.barcode.split(",").some((b: string) => b.trim().toLowerCase() === bc);
  });
  if (matchVar) {
    // Load the parent product (with all variants).
    const parentRes: any = await db.getAll(
      `SELECT id, name, price, barcode, is_available, stock_quantity, cost_price
       FROM products WHERE id = ?`,
      [matchVar.product_id],
    );
    const parentRows: Row[] = Array.isArray(parentRes) ? parentRes : (parentRes?.rows?._array ?? []);
    if (!parentRows[0]) return null;
    const allVarsRes: any = await db.getAll(
      `SELECT id, product_id, label, quantity, unit, price, is_available,
              is_default, barcode, stock_quantity
       FROM product_variants WHERE product_id = ?`,
      [matchVar.product_id],
    );
    const allVarRows: Row[] = Array.isArray(allVarsRes) ? allVarsRes : (allVarsRes?.rows?._array ?? []);
    const [product] = mapPosProducts(parentRows, allVarRows);
    const variant = product.product_variants.find((v) => v.id === matchVar.id) ?? null;
    return { product, variant };
  }

  const prodRes: any = await db.getAll(
    `SELECT id, name, price, barcode, is_available, stock_quantity, cost_price
     FROM products
     WHERE is_available = 1 AND (barcode = ? OR barcode LIKE ? COLLATE NOCASE)
     LIMIT 20`,
    [exact, prefix],
  );
  const candidateProdRows: Row[] = Array.isArray(prodRes) ? prodRes : (prodRes?.rows?._array ?? []);

  // Otherwise an exact product-level barcode match.
  const matchProd = candidateProdRows.find((p) => {
    if (!p.barcode) return false;
    return p.barcode.split(",").some((b: string) => b.trim().toLowerCase() === bc);
  });
  if (matchProd) {
    const allVarsRes: any = await db.getAll(
      `SELECT id, product_id, label, quantity, unit, price, is_available,
              is_default, barcode, stock_quantity
       FROM product_variants WHERE product_id = ?`,
      [matchProd.id],
    );
    const allVarRows: Row[] = Array.isArray(allVarsRes) ? allVarsRes : (allVarsRes?.rows?._array ?? []);
    const [product] = mapPosProducts([matchProd], allVarRows);
    const availableVariants = product.product_variants.filter((v) => v.is_available);
    const variant = availableVariants.find((v) => v.is_default) ?? availableVariants[0] ?? null;
    return { product, variant };
  }

  // Last-resort fallback for legacy comma-separated barcode strings where the
  // scanned value appears after the first comma. This only runs on no match.
  const contains = `%${exact}%`;
  const legacyRes: any = await db.getAll(
    `SELECT id, product_id, label, quantity, unit, price,
            is_available, is_default, barcode, stock_quantity
     FROM product_variants
     WHERE is_available = 1 AND barcode LIKE ? COLLATE NOCASE
     LIMIT 20`,
    [contains],
  );
  const legacyRows: Row[] = Array.isArray(legacyRes) ? legacyRes : (legacyRes?.rows?._array ?? []);
  const legacyVar = legacyRows.find((v) =>
    v.barcode?.split(",").some((b: string) => b.trim().toLowerCase() === bc),
  );
  if (legacyVar) {
    const parentRes: any = await db.getAll(
      `SELECT id, name, price, barcode, is_available, stock_quantity, cost_price
       FROM products WHERE id = ?`,
      [legacyVar.product_id],
    );
    const parentRows: Row[] = Array.isArray(parentRes) ? parentRes : (parentRes?.rows?._array ?? []);
    if (!parentRows[0]) return null;
    const allVarsRes: any = await db.getAll(
      `SELECT id, product_id, label, quantity, unit, price, is_available,
              is_default, barcode, stock_quantity
       FROM product_variants WHERE product_id = ?`,
      [legacyVar.product_id],
    );
    const allVarRows: Row[] = Array.isArray(allVarsRes) ? allVarsRes : (allVarsRes?.rows?._array ?? []);
    const [product] = mapPosProducts(parentRows, allVarRows);
    const variant = product.product_variants.find((v) => v.id === legacyVar.id) ?? null;
    return { product, variant };
  }

  const legacyProdRes: any = await db.getAll(
    `SELECT id, name, price, barcode, is_available, stock_quantity, cost_price
     FROM products
     WHERE is_available = 1 AND barcode LIKE ? COLLATE NOCASE
     LIMIT 20`,
    [contains],
  );
  const legacyProdRows: Row[] = Array.isArray(legacyProdRes) ? legacyProdRes : (legacyProdRes?.rows?._array ?? []);
  const legacyProd = legacyProdRows.find((p) =>
    p.barcode?.split(",").some((b: string) => b.trim().toLowerCase() === bc),
  );
  if (legacyProd) {
    const allVarsRes: any = await db.getAll(
      `SELECT id, product_id, label, quantity, unit, price, is_available,
              is_default, barcode, stock_quantity
       FROM product_variants WHERE product_id = ?`,
      [legacyProd.id],
    );
    const allVarRows: Row[] = Array.isArray(allVarsRes) ? allVarsRes : (allVarsRes?.rows?._array ?? []);
    const [product] = mapPosProducts([legacyProd], allVarRows);
    const availableVariants = product.product_variants.filter((v) => v.is_available);
    const variant = availableVariants.find((v) => v.is_default) ?? availableVariants[0] ?? null;
    return { product, variant };
  }

  return null;
}