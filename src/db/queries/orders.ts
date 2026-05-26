import { connectPowerSync } from "@/db/powersync";

// Local-first reads for the admin Orders page. Joins online orders with
// their items + related stores/contacts/addresses, plus POS transactions,
// all from the local PowerSync SQLite mirror. Returns the same merged
// shape the page consumed from Supabase so the UI is unchanged.

type Row = Record<string, any>;

const rowsOf = (res: any): Row[] =>
  Array.isArray(res) ? res : (res?.rows?._array ?? []);

const safeParse = <T,>(value: any, fallback: T): T => {
  if (value == null) return fallback;
  if (typeof value !== "string") return value as T;
  try { return JSON.parse(value) as T; } catch { return fallback; }
};

export interface LocalOrdersFilter {
  statusFilter: string; // "all" | order status
  start?: Date | null;
  end?: Date | null;
  searchQuery?: string;
}

function parseGuestInfo(deliveryInstructions: string | null) {
  let guestName = "", guestPhone = "", guestArea = "";
  if (deliveryInstructions && deliveryInstructions.includes("Guest Order")) {
    guestName = deliveryInstructions.match(/Name:\s*([^,]+)/)?.[1]?.trim() ?? "";
    guestPhone = deliveryInstructions.match(/Phone:\s*([^,]+)/)?.[1]?.trim() ?? "";
    guestArea = deliveryInstructions.match(/Area:\s*(.+)$/)?.[1]?.trim() ?? "";
  }
  return { guestName, guestPhone, guestArea };
}

export async function fetchAdminOrdersLocal(filter: LocalOrdersFilter) {
  const db = await connectPowerSync();
  const { statusFilter, start, end, searchQuery = "" } = filter;
  const q = searchQuery.trim().toLowerCase();
  const startIso = start ? start.toISOString() : null;
  const endIso = end ? end.toISOString() : null;

  // -------------------- Online orders --------------------
  const orderClauses: string[] = [];
  const orderArgs: any[] = [];
  if (statusFilter !== "all") {
    orderClauses.push("o.status = ?");
    orderArgs.push(statusFilter);
  }
  if (startIso && endIso) {
    orderClauses.push(
      "((o.created_at >= ? AND o.created_at <= ?) OR (o.updated_at >= ? AND o.updated_at <= ?))",
    );
    orderArgs.push(startIso, endIso, startIso, endIso);
  }
  // Push search predicate down so historical orders match even
  // beyond the recent-row cap.
  if (q) {
    const like = `%${q}%`;
    orderClauses.push(
      "(LOWER(o.order_number) LIKE ? OR LOWER(o.delivery_instructions) LIKE ? OR LOWER(c.name) LIKE ? OR LOWER(c.phone) LIKE ? OR LOWER(c.email) LIKE ?)",
    );
    orderArgs.push(like, like, like, like, like);
  }
  const orderWhere = orderClauses.length ? `WHERE ${orderClauses.join(" AND ")}` : "";

  const onlineRes: any = await db.getAll(
    `SELECT o.*, s.name AS store_name,
            a.address_line1 AS addr_line1, a.city AS addr_city, a.phone AS addr_phone,
            c.id AS contact_id, c.name AS contact_name, c.phone AS contact_phone, c.email AS contact_email
     FROM orders o
     LEFT JOIN stores s ON s.id = o.store_id
     LEFT JOIN addresses a ON a.id = o.address_id
     LEFT JOIN contacts c ON c.id = o.customer_id
     ${orderWhere}
     ORDER BY o.created_at DESC
     LIMIT 5000`,
    orderArgs,
  );
  const onlineRows = rowsOf(onlineRes);

  // Items grouped by order id
  let itemsByOrder = new Map<string, any[]>();
  if (onlineRows.length) {
    const ids = onlineRows.map((r) => r.id);
    const ph = ids.map(() => "?").join(",");
    const itemRes: any = await db.getAll(
      `SELECT oi.*, p.id AS p_id, p.name AS p_name, p.image_url AS p_image, p.price AS p_price, p.unit AS p_unit
       FROM order_items oi
       LEFT JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id IN (${ph})`,
      ids,
    );
    rowsOf(itemRes).forEach((it) => {
      const list = itemsByOrder.get(it.order_id) ?? [];
      list.push({
        ...it,
        products: it.p_id
          ? { id: it.p_id, name: it.p_name, image_url: it.p_image, price: it.p_price, unit: it.p_unit }
          : null,
      });
      itemsByOrder.set(it.order_id, list);
    });
  }

  const onlineMapped = onlineRows.map((order) => {
    const guest = parseGuestInfo(order.delivery_instructions);
    return {
      ...order,
      order_number: order.order_number,
      stores: order.store_name ? { name: order.store_name } : null,
      addresses: order.addr_line1
        ? { address_line1: order.addr_line1, city: order.addr_city, phone: order.addr_phone }
        : null,
      contacts: order.contact_id
        ? { id: order.contact_id, name: order.contact_name, phone: order.contact_phone, email: order.contact_email }
        : null,
      customer_name: order.contact_name || guest.guestName || "Guest",
      customer_phone: order.contact_phone || order.addr_phone || guest.guestPhone || null,
      customer_email: order.contact_email || null,
      delivery_address: order.addr_line1
        ? `${order.addr_line1}, ${order.addr_city}`
        : guest.guestArea || null,
      items: itemsByOrder.get(order.id) ?? [],
      type: "online" as const,
    };
  });

  // -------------------- POS transactions --------------------
  const posClauses: string[] = [];
  const posArgs: any[] = [];
  if (startIso && endIso) {
    posClauses.push("t.created_at >= ? AND t.created_at <= ?");
    posArgs.push(startIso, endIso);
  }
  if (q) {
    const like = `%${q}%`;
    posClauses.push(
      "(LOWER(t.transaction_number) LIKE ? OR LOWER(c.name) LIKE ? OR LOWER(c.phone) LIKE ?)",
    );
    posArgs.push(like, like, like);
  }
  const posWhere = posClauses.length ? `WHERE ${posClauses.join(" AND ")}` : "";
  const posLimit = startIso && endIso ? 5000 : (q ? 5000 : 500);

  const posRes: any = await db.getAll(
    `SELECT t.*, s.name AS store_name,
            c.name AS contact_name, c.phone AS contact_phone,
            COALESCE(pu1.full_name, pu2.full_name) AS cashier_full_name
     FROM pos_transactions t
     LEFT JOIN stores s ON s.id = t.store_id
     LEFT JOIN contacts c ON c.id = t.customer_id
     LEFT JOIN pos_users pu1 ON pu1.id = t.cashier_id
     LEFT JOIN pos_users pu2 ON pu2.user_id = t.cashier_id
     ${posWhere}
     ORDER BY t.created_at DESC
     LIMIT ${posLimit}`,
    posArgs,
  );
  const posRows = rowsOf(posRes);

  const posMapped = posRows
    .filter(() => statusFilter === "all" || statusFilter === "completed")
    .map((t) => ({
      id: t.id,
      order_number: t.transaction_number,
      customer_name: t.contact_name || "Walk-in Customer",
      customer_phone: t.contact_phone || null,
      customer_id: t.customer_id,
      stores: t.store_name ? { name: t.store_name } : null,
      store_id: t.store_id,
      total: t.total,
      subtotal: t.subtotal,
      tax: t.tax,
      discount: t.discount || 0,
      delivery_fee: 0,
      created_at: t.created_at,
      items: safeParse<any[]>(t.items, []),
      type: "pos" as const,
      status: "completed",
      payment_method: t.payment_method,
      payment_details: safeParse<any>(t.payment_details, null),
      cashier_name: t.cashier_full_name || "Unknown",
      cashier_id: t.cashier_id,
      addresses: null,
      metadata: safeParse<any>(t.metadata, null),
    }));

  const all: any[] = ([...onlineMapped, ...posMapped] as any[]).sort(
    (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  return all;
}