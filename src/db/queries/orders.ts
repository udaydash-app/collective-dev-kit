import { offlineDB } from "@/lib/offlineDB";

// Local-first reads for the admin Orders page, backed by the IndexedDB
// cache that `cacheEssentialData` populates. Returns the same merged shape
// the page consumed from Supabase so the UI is unchanged.

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
  const { statusFilter, start, end, searchQuery = "" } = filter;
  const q = searchQuery.trim().toLowerCase();
  const startMs = start ? start.getTime() : null;
  const endMs = end ? end.getTime() : null;

  // Load cached collections in parallel
  const [allOrders, allItems, allPos, allContacts, allStores, allProducts] = await Promise.all([
    offlineDB.getOrders().catch(() => []),
    offlineDB.getOrderItems().catch(() => []),
    offlineDB.getPOSTransactions().catch(() => []),
    offlineDB.getContacts().catch(() => []),
    offlineDB.getStores().catch(() => []),
    offlineDB.getProducts().catch(() => []),
  ]);

  const contactById = new Map<string, any>(
    allContacts.map((c: any) => [c.id, c] as [string, any]),
  );
  const storeById = new Map<string, any>(
    allStores.map((s: any) => [s.id, s] as [string, any]),
  );
  const productById = new Map<string, any>(
    (allProducts as any[]).map((p: any) => [p.id, p]),
  );

  const itemsByOrder = new Map<string, any[]>();
  for (const it of allItems) {
    const list = itemsByOrder.get(it.order_id) ?? [];
    list.push(it);
    itemsByOrder.set(it.order_id, list);
  }

  const inDateRange = (iso: string | null | undefined, alt?: string | null) => {
    if (startMs == null || endMs == null) return true;
    const t1 = iso ? new Date(iso).getTime() : NaN;
    const t2 = alt ? new Date(alt).getTime() : NaN;
    const hit = (t: number) => !isNaN(t) && t >= startMs && t <= endMs;
    return hit(t1) || hit(t2);
  };

  // -------------------- Online orders --------------------
  const onlineMapped = allOrders
    .filter((o: any) => statusFilter === "all" || o.status === statusFilter)
    .filter((o: any) => inDateRange(o.created_at, o.updated_at))
    .filter((o: any) => {
      if (!q) return true;
      const c = contactById.get(o.customer_id);
      const hay = [
        o.order_number,
        o.delivery_instructions,
        c?.name,
        c?.phone,
        c?.email,
      ].filter(Boolean).join(" ").toLowerCase();
      if (hay.includes(q)) return true;
      // Also match product names inside the order's items.
      const items = itemsByOrder.get(o.id) ?? [];
      return items.some((it: any) => {
        const name = (it.products?.name || productById.get(it.product_id)?.name || it.name || "").toLowerCase();
        return name.includes(q);
      });
    })
    .map((order: any) => {
      const guest = parseGuestInfo(order.delivery_instructions);
      const contact = contactById.get(order.customer_id);
      const store = storeById.get(order.store_id);
      return {
        ...order,
        stores: store ? { name: store.name } : null,
        addresses: null,
        contacts: contact
          ? { id: contact.id, name: contact.name, phone: contact.phone, email: contact.email }
          : null,
        customer_name: contact?.name || guest.guestName || "Guest",
        customer_phone: contact?.phone || guest.guestPhone || null,
        customer_email: contact?.email || null,
        delivery_address: guest.guestArea || null,
        items: itemsByOrder.get(order.id) ?? [],
        type: "online" as const,
      };
    });

  // -------------------- POS transactions --------------------
  const posMapped = allPos
    .filter(() => statusFilter === "all" || statusFilter === "completed")
    .filter((t: any) => inDateRange(t.created_at))
    .filter((t: any) => {
      if (!q) return true;
      const c = contactById.get(t.customer_id);
      const hay = [t.transaction_number, c?.name, c?.phone]
        .filter(Boolean).join(" ").toLowerCase();
      if (hay.includes(q)) return true;
      // Search product names inside the transaction items JSON.
      const items = safeParse<any[]>(t.items, []);
      return items.some((it: any) => {
        const name = (it.name || it.product_name || productById.get(it.product_id)?.name || "").toLowerCase();
        return name.includes(q);
      });
    })
    .map((t: any) => {
      const contact = contactById.get(t.customer_id);
      const store = storeById.get(t.store_id);
      return {
        id: t.id,
        order_number: t.transaction_number,
        customer_name: contact?.name || "Walk-in Customer",
        customer_phone: contact?.phone || null,
        customer_id: t.customer_id,
        stores: store ? { name: store.name } : null,
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
        cashier_name: "Unknown",
        cashier_id: t.cashier_id,
        addresses: null,
        metadata: safeParse<any>(t.metadata, null),
      };
    });

  const all: any[] = ([...onlineMapped, ...posMapped] as any[]).sort(
    (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  return all;
}