import { connectPowerSync } from "@/db/powersync";

type Row = Record<string, any>;
const rowsOf = (res: any): Row[] =>
  Array.isArray(res) ? res : (res?.rows?._array ?? []);

const toBool = (v: any) => v === 1 || v === true;

export async function fetchCustomersLocal(): Promise<any[]> {
  const db = await connectPowerSync();
  const res: any = await db.getAll(
    `SELECT * FROM contacts WHERE is_customer = 1 ORDER BY name`,
  );
  return rowsOf(res).map((r) => ({
    ...r,
    is_customer: toBool(r.is_customer),
    is_supplier: toBool(r.is_supplier),
  }));
}

export async function fetchPaymentReceiptsLocal(searchTerm?: string): Promise<any[]> {
  const db = await connectPowerSync();
  const params: any[] = [];
  let where = "";
  if (searchTerm && searchTerm.trim()) {
    where = "WHERE pr.receipt_number LIKE ? OR pr.reference LIKE ?";
    const like = `%${searchTerm.trim()}%`;
    params.push(like, like);
  }
  const res: any = await db.getAll(
    `SELECT pr.*, c.name AS contact_name_fk
     FROM payment_receipts pr
     LEFT JOIN contacts c ON c.id = pr.contact_id
     ${where}
     ORDER BY pr.created_at DESC`,
    params,
  );
  return rowsOf(res).map((r) => ({
    ...r,
    contacts: r.contact_id ? { name: r.contact_name_fk } : null,
    profiles: { full_name: "" },
  }));
}

export async function fetchSupplierPaymentsLocal(searchTerm?: string): Promise<any[]> {
  const db = await connectPowerSync();
  const params: any[] = [];
  let where = "";
  if (searchTerm && searchTerm.trim()) {
    where = "WHERE sp.payment_number LIKE ? OR sp.reference LIKE ?";
    const like = `%${searchTerm.trim()}%`;
    params.push(like, like);
  }
  const res: any = await db.getAll(
    `SELECT sp.*,
            c.name AS contact_name_fk,
            p.purchase_number AS purchase_number_fk,
            p.total_amount AS purchase_total_fk
     FROM supplier_payments sp
     LEFT JOIN contacts c ON c.id = sp.contact_id
     LEFT JOIN purchases p ON p.id = sp.purchase_id
     ${where}
     ORDER BY sp.created_at DESC`,
    params,
  );
  return rowsOf(res).map((r) => ({
    ...r,
    contacts: r.contact_id ? { name: r.contact_name_fk } : null,
    purchases: r.purchase_id
      ? { purchase_number: r.purchase_number_fk, total_amount: r.purchase_total_fk }
      : null,
    profiles: { full_name: "" },
  }));
}

export async function fetchOutstandingPurchasesLocal(supplierName: string): Promise<any[]> {
  const db = await connectPowerSync();
  const res: any = await db.getAll(
    `SELECT id, purchase_number, total_amount, amount_paid, payment_status, purchased_at
     FROM purchases
     WHERE supplier_name = ? AND payment_status IN ('pending','partial')
     ORDER BY purchased_at DESC`,
    [supplierName],
  );
  return rowsOf(res);
}