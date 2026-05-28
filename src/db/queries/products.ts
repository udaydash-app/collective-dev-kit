import { connectPowerSync } from "@/db/powersync";
import { supabase } from "@/integrations/supabase/client";
import { isElectronLocalDb, localRows } from "@/integrations/db/localSql";
import { offlineDB } from "@/lib/offlineDB";

// Reactive-ish helpers that read products/categories/stores/suppliers
// from the local PowerSync SQLite database. JOINs are executed locally,
// so reads are instant and work offline. Writes still go through Supabase
// and stream back via PowerSync replication.

type Row = Record<string, any>;

const toBool = (v: any) => v === 1 || v === true;

async function queryRows(sql: string, params: unknown[] = []): Promise<Row[]> {
  if (isElectronLocalDb()) {
    try {
      return await localRows<Row>(sql, params);
    } catch (e) {
      // Local PGlite table missing or empty — return [] so callers fall back to cloud.
      console.warn('[products] Local PGlite query failed, will try cloud:', (e as Error)?.message);
      return [];
    }
  }
  try {
    const db = await connectPowerSync();
    const result: any = await db.getAll(sql, params);
    return Array.isArray(result) ? result : (result?.rows?._array ?? []);
  } catch (e) {
    console.warn('[products] PowerSync query failed, will try cloud:', (e as Error)?.message);
    return [];
  }
}

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
  const [rows, vRows] = await Promise.all([
    queryRows(productsSql),
    queryRows(variantsSql),
  ]);
  // Fallback: if the local mirror is empty (PowerSync not yet synced, or the
  // Electron PGlite snapshot was never seeded), fetch from cloud Supabase.
  if (rows.length === 0 && navigator.onLine) {
    try {
      const { data, error } = await supabase
        .from("products")
        .select(`
          *,
          categories(name),
          stores(name),
          contacts:supplier_id(name),
          product_variants(*)
        `)
        .order("created_at", { ascending: false });
      if (!error && data) return data as any[];
    } catch (e) {
      console.warn("[products] Supabase fallback failed", e);
    }
  }
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
  const rows = await queryRows(
    `SELECT id, name FROM categories WHERE is_active = 1 ORDER BY name`,
  );
  if (rows.length === 0 && navigator.onLine) {
    try {
      const { data } = await supabase
        .from("categories")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (data && data.length > 0) return data as any[];
    } catch (e) {
      console.warn("[categories] Supabase fallback failed", e);
    }
  }
  if (rows.length === 0) {
    try {
      const cached = await offlineDB.getCategories?.();
      if (cached && cached.length > 0) {
        return cached
          .filter((c: any) => c.is_active !== false)
          .map((c: any) => ({ id: c.id, name: c.name }));
      }
    } catch (e) {
      console.warn("[categories] IndexedDB fallback failed", e);
    }
  }
  return rows.map((r) => ({ id: r.id, name: r.name }));
}

export async function fetchStoresLocal() {
  const rows = await queryRows(
    `SELECT id, name FROM stores WHERE is_active = 1 ORDER BY name`,
  );
  if (rows.length === 0 && navigator.onLine) {
    try {
      const { data } = await supabase
        .from("stores")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (data && data.length > 0) return data as any[];
    } catch (e) {
      console.warn("[stores] Supabase fallback failed", e);
    }
  }
  if (rows.length === 0) {
    try {
      const cached = await offlineDB.getStores();
      if (cached && cached.length > 0) {
        return cached
          .filter((s: any) => s.is_active !== false)
          .map((s: any) => ({ id: s.id, name: s.name }));
      }
    } catch (e) {
      console.warn("[stores] IndexedDB fallback failed", e);
    }
  }
  return rows.map((r) => ({ id: r.id, name: r.name }));
}

export async function fetchSuppliersLocal() {
  const rows = await queryRows(
    `SELECT id, name FROM contacts WHERE is_supplier = 1 ORDER BY name`,
  );
  if (rows.length === 0 && navigator.onLine) {
    try {
      const { data } = await supabase
        .from("contacts")
        .select("id, name")
        .eq("is_supplier", true)
        .order("name");
      if (data && data.length > 0) return data as any[];
    } catch (e) {
      console.warn("[suppliers] Supabase fallback failed", e);
    }
  }
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

type BarcodeMatch = {
  product: PosProduct;
  variant: PosProduct["product_variants"][0] | null;
};

type PosProductSearchEntry = {
  product: PosProduct;
  name: string;
  productBarcodes: string[];
  variantBarcodes: Array<{ barcode: string; variant: PosProduct["product_variants"][0] }>;
};

type PosProductsIndex = {
  products: PosProduct[];
  entries: PosProductSearchEntry[];
  barcodeMap: Map<string, BarcodeMatch>;
};

let posProductsIndexPromise: Promise<PosProductsIndex> | null = null;
let posProductsIndex: PosProductsIndex | null = null;

const splitBarcodes = (value?: string | null) =>
  (value ?? "")
    .split(",")
    .map((b) => b.trim().toLowerCase())
    .filter(Boolean);

function buildPosProductsIndex(products: PosProduct[]): PosProductsIndex {
  const barcodeMap = new Map<string, BarcodeMatch>();
  const entries = products.map((product) => {
    const availableVariants = product.product_variants.filter((v) => v.is_available);
    const defaultVariant = availableVariants.find((v) => v.is_default) ?? availableVariants[0] ?? null;
    const productBarcodes = splitBarcodes(product.barcode);
    const variantBarcodes = availableVariants.flatMap((variant) =>
      splitBarcodes(variant.barcode).map((barcode) => ({ barcode, variant })),
    );

    for (const { barcode, variant } of variantBarcodes) {
      if (!barcodeMap.has(barcode)) barcodeMap.set(barcode, { product, variant });
    }
    for (const barcode of productBarcodes) {
      if (!barcodeMap.has(barcode)) barcodeMap.set(barcode, { product, variant: defaultVariant });
    }

    return {
      product,
      name: product.name.toLowerCase(),
      productBarcodes,
      variantBarcodes,
    };
  });

  return { products, entries, barcodeMap };
}

async function loadPosProductsIndex(): Promise<PosProductsIndex> {
  const [prodRows, varRows] = await Promise.all([
    queryRows(
      `SELECT id, name, price, barcode, is_available, stock_quantity, cost_price
       FROM products WHERE is_available = 1 ORDER BY name`,
    ),
    queryRows(
      `SELECT id, product_id, label, quantity, unit, price, is_available,
              is_default, barcode, stock_quantity
       FROM product_variants`,
    ),
  ]);
  // Cloud fallback when local mirror is empty (Electron / first launch).
  if (prodRows.length === 0 && navigator.onLine) {
    try {
      const [{ data: pData }, { data: vData }] = await Promise.all([
        supabase
          .from("products")
          .select("id, name, price, barcode, is_available, stock_quantity, cost_price")
          .eq("is_available", true)
          .order("name"),
        supabase
          .from("product_variants")
          .select("id, product_id, label, quantity, unit, price, is_available, is_default, barcode, stock_quantity"),
      ]);
      if (pData && pData.length) {
        const index = buildPosProductsIndex(mapPosProducts(pData as any, (vData ?? []) as any));
        posProductsIndex = index;
        return index;
      }
    } catch (e) {
      console.warn("[pos products] Supabase fallback failed", e);
    }
  }
  const index = buildPosProductsIndex(mapPosProducts(prodRows, varRows));
  posProductsIndex = index;
  return index;
}

export function invalidatePosProductsLocalIndex() {
  posProductsIndex = null;
  posProductsIndexPromise = null;
}

export function warmPosProductsLocalIndex() {
  if (!posProductsIndexPromise) {
    posProductsIndexPromise = loadPosProductsIndex().catch((error) => {
      posProductsIndexPromise = null;
      throw error;
    });
  }
  return posProductsIndexPromise;
}

function getWarmPosProductsIndex(): PosProductsIndex | null {
  return posProductsIndex;
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
  const cachedIndex = getWarmPosProductsIndex();
  if (cachedIndex) {
    const query = term.trim().toLowerCase();
    if (!query) return cachedIndex.products.slice(0, limit);

    const exactBarcodeMatch = cachedIndex.barcodeMap.get(query);
    if (exactBarcodeMatch) {
      return [{
        ...exactBarcodeMatch.product,
        _matchingVariant: exactBarcodeMatch.variant ?? undefined,
      } as PosProduct];
    }

    const results: PosProduct[] = [];
    const seen = new Set<string>();
    for (const entry of cachedIndex.entries) {
      if (results.length >= limit) break;
      const matchingVariant = entry.variantBarcodes.find(({ barcode }) => barcode.startsWith(query))?.variant;
      const matches = entry.name.startsWith(query)
        || entry.name.includes(query)
        || entry.productBarcodes.some((barcode) => barcode.startsWith(query) || barcode.includes(query))
        || Boolean(matchingVariant);
      if (matches && !seen.has(entry.product.id)) {
        seen.add(entry.product.id);
        results.push({
          ...entry.product,
          _matchingVariant: matchingVariant,
        } as PosProduct);
      }
    }
    return results;
  }

  const productRowsById = new Map<string, Row>();
  if (!term) {
    const prodRows = await queryRows(
      `SELECT id, name, price, barcode, is_available, stock_quantity, cost_price
       FROM products WHERE is_available = 1 ORDER BY name LIMIT ?`,
      [limit],
    );
    prodRows.forEach((p) => productRowsById.set(p.id, p));
  } else {
    const exact = term.trim();
    const prefix = `${exact}%`;
    const prodRows = await queryRows(
      `SELECT id, name, price, barcode, is_available, stock_quantity, cost_price
       FROM products
       WHERE is_available = 1
          AND (barcode = ? OR name LIKE ? COLLATE NOCASE OR barcode LIKE ? COLLATE NOCASE)
       ORDER BY name LIMIT ?`,
      [exact, prefix, prefix, limit],
    );
    prodRows.forEach((p) => productRowsById.set(p.id, p));

    if (productRowsById.size < limit) {
      const varProductRows = await queryRows(
        `SELECT DISTINCT p.id, p.name, p.price, p.barcode, p.is_available, p.stock_quantity, p.cost_price
         FROM product_variants v
         JOIN products p ON p.id = v.product_id
         WHERE v.is_available = 1 AND p.is_available = 1
           AND (v.barcode = ? OR v.barcode LIKE ? COLLATE NOCASE)
         ORDER BY p.name LIMIT ?`,
        [exact, prefix, limit - productRowsById.size],
      );
      varProductRows.forEach((p) => productRowsById.set(p.id, p));
    }

    if (productRowsById.size === 0) {
      const contains = `%${exact}%`;
      const fallbackRows = await queryRows(
        `SELECT id, name, price, barcode, is_available, stock_quantity, cost_price
         FROM products
         WHERE is_available = 1
           AND (name LIKE ? COLLATE NOCASE OR barcode LIKE ? COLLATE NOCASE)
         ORDER BY name LIMIT ?`,
        [contains, contains, limit],
      );
      fallbackRows.forEach((p) => productRowsById.set(p.id, p));
    }
  }
  const prodRows = Array.from(productRowsById.values()).slice(0, limit);
  if (prodRows.length === 0) return [];
  const ids = prodRows.map((p) => p.id);
  const placeholders = ids.map(() => "?").join(",");
  const varRows = await queryRows(
    `SELECT id, product_id, label, quantity, unit, price, is_available,
            is_default, barcode, stock_quantity
     FROM product_variants WHERE product_id IN (${placeholders})`,
    ids,
  );
  return mapPosProducts(prodRows, varRows);
}

/**
 * Find a single available product matching an exact barcode at the product
 * or variant level. Handles comma-separated barcodes. Returns null if none.
 */
export async function findPosProductByBarcodeLocal(
  barcode: string,
): Promise<BarcodeMatch | null> {
  const bc = barcode.trim().toLowerCase();
  const cachedIndex = getWarmPosProductsIndex();
  if (cachedIndex) {
    return cachedIndex.barcodeMap.get(bc) ?? null;
  }

  const exact = barcode.trim();
  const prefix = `${exact}%`;
  // Pull only index-friendly barcode candidates first. Comma-separated legacy
  // barcodes still work when the scanned value is the first listed barcode.
  const candidateVarRows = await queryRows(
    `SELECT id, product_id, label, quantity, unit, price,
            is_available, is_default, barcode, stock_quantity
     FROM product_variants
     WHERE is_available = 1 AND (barcode = ? OR barcode LIKE ? COLLATE NOCASE)
     LIMIT 20`,
    [exact, prefix],
  );

  // Prefer exact variant match.
  const matchVar = candidateVarRows.find((v) => {
    if (!v.barcode) return false;
    return v.barcode.split(",").some((b: string) => b.trim().toLowerCase() === bc);
  });
  if (matchVar) {
    // Load the parent product (with all variants).
    const parentRows = await queryRows(
      `SELECT id, name, price, barcode, is_available, stock_quantity, cost_price
       FROM products WHERE id = ?`,
      [matchVar.product_id],
    );
    if (!parentRows[0]) return null;
    const allVarRows = await queryRows(
      `SELECT id, product_id, label, quantity, unit, price, is_available,
              is_default, barcode, stock_quantity
       FROM product_variants WHERE product_id = ?`,
      [matchVar.product_id],
    );
    const [product] = mapPosProducts(parentRows, allVarRows);
    const variant = product.product_variants.find((v) => v.id === matchVar.id) ?? null;
    return { product, variant };
  }

  const candidateProdRows = await queryRows(
    `SELECT id, name, price, barcode, is_available, stock_quantity, cost_price
     FROM products
     WHERE is_available = 1 AND (barcode = ? OR barcode LIKE ? COLLATE NOCASE)
     LIMIT 20`,
    [exact, prefix],
  );

  // Otherwise an exact product-level barcode match.
  const matchProd = candidateProdRows.find((p) => {
    if (!p.barcode) return false;
    return p.barcode.split(",").some((b: string) => b.trim().toLowerCase() === bc);
  });
  if (matchProd) {
    const allVarRows = await queryRows(
      `SELECT id, product_id, label, quantity, unit, price, is_available,
              is_default, barcode, stock_quantity
       FROM product_variants WHERE product_id = ?`,
      [matchProd.id],
    );
    const [product] = mapPosProducts([matchProd], allVarRows);
    const availableVariants = product.product_variants.filter((v) => v.is_available);
    const variant = availableVariants.find((v) => v.is_default) ?? availableVariants[0] ?? null;
    return { product, variant };
  }

  // Last-resort fallback for legacy comma-separated barcode strings where the
  // scanned value appears after the first comma. This only runs on no match.
  const contains = `%${exact}%`;
  const legacyRows = await queryRows(
    `SELECT id, product_id, label, quantity, unit, price,
            is_available, is_default, barcode, stock_quantity
     FROM product_variants
     WHERE is_available = 1 AND barcode LIKE ? COLLATE NOCASE
     LIMIT 20`,
    [contains],
  );
  const legacyVar = legacyRows.find((v) =>
    v.barcode?.split(",").some((b: string) => b.trim().toLowerCase() === bc),
  );
  if (legacyVar) {
    const parentRows = await queryRows(
      `SELECT id, name, price, barcode, is_available, stock_quantity, cost_price
       FROM products WHERE id = ?`,
      [legacyVar.product_id],
    );
    if (!parentRows[0]) return null;
    const allVarRows = await queryRows(
      `SELECT id, product_id, label, quantity, unit, price, is_available,
              is_default, barcode, stock_quantity
       FROM product_variants WHERE product_id = ?`,
      [legacyVar.product_id],
    );
    const [product] = mapPosProducts(parentRows, allVarRows);
    const variant = product.product_variants.find((v) => v.id === legacyVar.id) ?? null;
    return { product, variant };
  }

  const legacyProdRows = await queryRows(
    `SELECT id, name, price, barcode, is_available, stock_quantity, cost_price
     FROM products
     WHERE is_available = 1 AND barcode LIKE ? COLLATE NOCASE
     LIMIT 20`,
    [contains],
  );
  const legacyProd = legacyProdRows.find((p) =>
    p.barcode?.split(",").some((b: string) => b.trim().toLowerCase() === bc),
  );
  if (legacyProd) {
    const allVarRows = await queryRows(
      `SELECT id, product_id, label, quantity, unit, price, is_available,
              is_default, barcode, stock_quantity
       FROM product_variants WHERE product_id = ?`,
      [legacyProd.id],
    );
    const [product] = mapPosProducts([legacyProd], allVarRows);
    const availableVariants = product.product_variants.filter((v) => v.is_available);
    const variant = availableVariants.find((v) => v.is_default) ?? availableVariants[0] ?? null;
    return { product, variant };
  }

  return null;
}