import { supabase } from "@/integrations/supabase/client";

/**
 * Post a Purchase Bill:
 *  - Dr Inventory (subtotal)
 *  - Dr Tax Payable (tax_amount)            [recoverable input tax treated as asset-like; using Tax Payable account here for simplicity]
 *  - Cr Accounts Payable (total)
 * Update each item: stock_qty += qty, avg_cost = (old_value + line_amount) / new_qty (weighted-average).
 *
 * Returns the journal entry id on success.
 */
export async function postBill(billId: string): Promise<string> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Not authenticated");
  const userId = u.user.id;

  // Load bill
  const { data: bill, error: bErr } = await supabase
    .from("bills").select("*").eq("id", billId).single();
  if (bErr || !bill) throw bErr ?? new Error("Bill not found");
  if (bill.status === "paid" || bill.status === "void") {
    throw new Error("Cannot re-post a paid or void bill");
  }

  // If a journal entry already exists for this bill (re-posting after edit),
  // reverse the prior inventory movement and delete the old JE so we can re-post fresh.
  const { data: existingJE } = await supabase
    .from("journal_entries").select("id")
    .eq("source_type", "bill").eq("source_id", bill.id).maybeSingle();
  if (existingJE?.id) {
    // Reverse previous inventory effect from old bill_lines snapshot
    const { data: oldLines } = await supabase
      .from("bill_lines").select("item_id, quantity, amount").eq("bill_id", bill.id);
    const oldItemLines = (oldLines ?? []).filter((l) => l.item_id);
    if (oldItemLines.length > 0) {
      const oldAgg = new Map<string, { qty: number; amount: number }>();
      for (const l of oldItemLines) {
        const cur = oldAgg.get(l.item_id as string) ?? { qty: 0, amount: 0 };
        cur.qty += Number(l.quantity);
        cur.amount += Number(l.amount);
        oldAgg.set(l.item_id as string, cur);
      }
      const ids = Array.from(oldAgg.keys());
      const { data: itemsNow } = await supabase
        .from("items").select("id, stock_qty, avg_cost").in("id", ids);
      const byId = new Map(itemsNow?.map((i) => [i.id, i]) ?? []);
      for (const [itemId, { qty, amount }] of oldAgg) {
        const it = byId.get(itemId);
        if (!it) continue;
        const curQty = Number(it.stock_qty);
        const curCost = Number(it.avg_cost);
        const newQty = curQty - qty;
        // Reverse weighted-average: previous total value minus this bill's contribution
        const newCost = newQty > 0 ? Math.max(0, (curQty * curCost - amount) / newQty) : 0;
        await supabase.from("items")
          .update({ stock_qty: newQty, avg_cost: newCost }).eq("id", itemId);
      }
    }
    await supabase.from("journal_lines").delete().eq("entry_id", existingJE.id);
    await supabase.from("journal_entries").delete().eq("id", existingJE.id);
  }

  // Load lines
  const { data: lines, error: lErr } = await supabase
    .from("bill_lines").select("*").eq("bill_id", billId);
  if (lErr) throw lErr;
  if (!lines || lines.length === 0) throw new Error("Bill has no lines");

  // Load required system accounts
  const { data: accounts, error: aErr } = await supabase
    .from("accounts").select("id, code")
    .eq("company_id", bill.company_id)
    .in("code", ["1200", "2000", "2100"]);
  if (aErr) throw aErr;
  const acctByCode = Object.fromEntries((accounts ?? []).map((a) => [a.code, a.id]));
  const inventoryId = acctByCode["1200"];
  const taxId = acctByCode["2100"];
  if (!inventoryId || !taxId) {
    throw new Error("Missing system accounts (Inventory / Tax Payable)");
  }
  // AP sub-account for this supplier (created on first use)
  const { data: apSubId, error: apSubErr } = await supabase
    .rpc("get_or_create_contact_account", { p_contact_id: bill.contact_id, p_kind: "ap", p_company_id: bill.company_id });
  if (apSubErr || !apSubId) throw apSubErr ?? new Error("Could not resolve supplier AP sub-account");
  const apId = apSubId as string;

  const subtotal = Number(bill.subtotal);
  const taxAmount = Number(bill.tax_amount);
  const total = Number(bill.total);

  // Create journal entry
  const { data: je, error: jeErr } = await supabase
    .from("journal_entries")
    .insert({
      user_id: userId,
      company_id: bill.company_id,
      entry_date: bill.bill_date,
      narration: `Bill ${bill.bill_number}`,
      reference: bill.bill_number,
      source_type: "bill",
      source_id: bill.id,
    })
    .select("id").single();
  if (jeErr || !je) throw jeErr ?? new Error("Could not create journal entry");

  // Journal lines
  const jLines: Array<{ account_id: string; debit: number; credit: number; description?: string }> = [];
  if (subtotal > 0) jLines.push({ account_id: inventoryId, debit: subtotal, credit: 0, description: "Inventory" });
  if (taxAmount > 0) jLines.push({ account_id: taxId, debit: taxAmount, credit: 0, description: "Input tax" });
  jLines.push({ account_id: apId, debit: 0, credit: total, description: "Accounts payable" });

  const { error: jlErr } = await supabase.from("journal_lines").insert(
    jLines.map((l) => ({
      ...l,
      user_id: userId,
      company_id: bill.company_id,
      entry_id: je.id,
      contact_id: bill.contact_id,
    })),
  );
  if (jlErr) {
    // best-effort cleanup
    await supabase.from("journal_entries").delete().eq("id", je.id);
    throw jlErr;
  }

  // Update inventory: stock + weighted-average cost
  const itemLines = lines.filter((l) => l.item_id);
  if (itemLines.length > 0) {
    const itemIds = Array.from(new Set(itemLines.map((l) => l.item_id as string)));
    const { data: items, error: iErr } = await supabase
      .from("items").select("id, stock_qty, avg_cost").in("id", itemIds);
    if (iErr) throw iErr;
    const byId = new Map(items?.map((i) => [i.id, i]) ?? []);

    // aggregate by item (a bill may have several lines for same item)
    const agg = new Map<string, { qty: number; amount: number }>();
    for (const l of itemLines) {
      const cur = agg.get(l.item_id as string) ?? { qty: 0, amount: 0 };
      cur.qty += Number(l.quantity);
      cur.amount += Number(l.amount);
      agg.set(l.item_id as string, cur);
    }

    for (const [itemId, { qty, amount }] of agg) {
      const it = byId.get(itemId);
      if (!it) continue;
      const oldQty = Number(it.stock_qty);
      const oldCost = Number(it.avg_cost);
      const newQty = oldQty + qty;
      const newCost = newQty > 0 ? (oldQty * oldCost + amount) / newQty : oldCost;
      const { error: upErr } = await supabase
        .from("items")
        .update({ stock_qty: newQty, avg_cost: newCost })
        .eq("id", itemId);
      if (upErr) throw upErr;
    }
  }

  // Mark bill as open (posted)
  const { error: upBillErr } = await supabase
    .from("bills").update({ status: "open" }).eq("id", bill.id);
  if (upBillErr) throw upBillErr;

  return je.id;
}

/**
 * Post a Sales Invoice:
 *  - Dr Accounts Receivable (total)
 *  - Cr Sales Revenue (subtotal)
 *  - Cr Tax Payable (tax_amount)
 * Plus, for each item line (if item_id):
 *  - Dr Cost of Goods Sold (qty × current avg_cost)
 *  - Cr Inventory (qty × current avg_cost)
 *  - Decrease item.stock_qty by qty (avg_cost unchanged on sales)
 *
 * Returns the journal entry id on success.
 */
export async function postInvoice(invoiceId: string): Promise<string> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Not authenticated");
  const userId = u.user.id;

  const { data: inv, error: iErr } = await supabase
    .from("invoices").select("*").eq("id", invoiceId).single();
  if (iErr || !inv) throw iErr ?? new Error("Invoice not found");
  if (inv.status !== "draft") throw new Error("Only draft invoices can be posted");

  const { data: lines, error: lErr } = await supabase
    .from("invoice_lines").select("*").eq("invoice_id", invoiceId);
  if (lErr) throw lErr;
  if (!lines || lines.length === 0) throw new Error("Invoice has no lines");

  const { data: accounts, error: aErr } = await supabase
    .from("accounts").select("id, code")
    .eq("company_id", inv.company_id)
    .in("code", ["1200", "2100", "4000", "5000"]);
  if (aErr) throw aErr;
  const acct = Object.fromEntries((accounts ?? []).map((a) => [a.code, a.id]));
  const inventoryId = acct["1200"];
  const taxId = acct["2100"];
  const salesId = acct["4000"];
  const cogsId = acct["5000"];
  if (!inventoryId || !taxId || !salesId || !cogsId) {
    throw new Error("Missing system accounts (Inventory / Tax Payable / Sales / COGS)");
  }
  const { data: arSubId, error: arSubErr } = await supabase
    .rpc("get_or_create_contact_account", { p_contact_id: inv.contact_id, p_kind: "ar", p_company_id: inv.company_id });
  if (arSubErr || !arSubId) throw arSubErr ?? new Error("Could not resolve customer AR sub-account");
  const arId = arSubId as string;

  const subtotal = Number(inv.subtotal);
  const taxAmount = Number(inv.tax_amount);
  const total = Number(inv.total);

  // Aggregate qty by item and check stock + compute COGS using current avg_cost
  const itemLines = lines.filter((l) => l.item_id);
  const agg = new Map<string, { qty: number }>();
  for (const l of itemLines) {
    const cur = agg.get(l.item_id as string) ?? { qty: 0 };
    cur.qty += Number(l.quantity);
    agg.set(l.item_id as string, cur);
  }

  let totalCogs = 0;
  const itemUpdates: Array<{ id: string; newQty: number; cogs: number }> = [];
  if (agg.size > 0) {
    const ids = Array.from(agg.keys());
    const { data: items, error: itErr } = await supabase
      .from("items").select("id, name, stock_qty, avg_cost").in("id", ids);
    if (itErr) throw itErr;
    const byId = new Map(items?.map((i) => [i.id, i]) ?? []);
    for (const [itemId, { qty }] of agg) {
      const it = byId.get(itemId);
      if (!it) throw new Error("Item not found");
      const stock = Number(it.stock_qty);
      const cost = Number(it.avg_cost);
      if (qty > stock) {
        throw new Error(`Insufficient stock for ${it.name}: have ${stock}, need ${qty}`);
      }
      const cogs = qty * cost;
      totalCogs += cogs;
      itemUpdates.push({ id: itemId, newQty: stock - qty, cogs });
    }
  }

  // Create journal entry
  const { data: je, error: jeErr } = await supabase
    .from("journal_entries")
    .insert({
      user_id: userId,
      company_id: inv.company_id,
      entry_date: inv.invoice_date,
      narration: `Invoice ${inv.invoice_number}`,
      reference: inv.invoice_number,
      source_type: "invoice",
      source_id: inv.id,
    })
    .select("id").single();
  if (jeErr || !je) throw jeErr ?? new Error("Could not create journal entry");

  const jLines: Array<{ account_id: string; debit: number; credit: number; description: string }> = [];
  jLines.push({ account_id: arId, debit: total, credit: 0, description: "Accounts receivable" });
  if (subtotal > 0) jLines.push({ account_id: salesId, debit: 0, credit: subtotal, description: "Sales revenue" });
  if (taxAmount > 0) jLines.push({ account_id: taxId, debit: 0, credit: taxAmount, description: "Output tax" });
  if (totalCogs > 0) {
    jLines.push({ account_id: cogsId, debit: totalCogs, credit: 0, description: "Cost of goods sold" });
    jLines.push({ account_id: inventoryId, debit: 0, credit: totalCogs, description: "Inventory" });
  }

  const { error: jlErr } = await supabase.from("journal_lines").insert(
    jLines.map((l) => ({ ...l, user_id: userId, company_id: inv.company_id, entry_id: je.id, contact_id: inv.contact_id })),
  );
  if (jlErr) {
    await supabase.from("journal_entries").delete().eq("id", je.id);
    throw jlErr;
  }

  // Decrease stock (avg_cost unchanged on sales)
  for (const u of itemUpdates) {
    const { error: upErr } = await supabase
      .from("items").update({ stock_qty: u.newQty }).eq("id", u.id);
    if (upErr) throw upErr;
  }

  const { error: upInvErr } = await supabase
    .from("invoices").update({ status: "open" }).eq("id", inv.id);
  if (upInvErr) throw upInvErr;

  return je.id;
}

/**
 * Post a Payment or Receipt:
 *  - Receipt (direction='in'):  Dr Cash/Bank, Cr Accounts Receivable
 *  - Payment (direction='out'): Dr Accounts Payable, Cr Cash/Bank
 *
 * Allocation:
 *  - If the payment is linked to a single invoice/bill (invoice_id/bill_id set),
 *    the full amount is applied to that document.
 *  - If neither is set, the amount is auto-allocated FIFO across the contact's
 *    open/partial documents (oldest first). Excess (overpayment) becomes
 *    unallocated credit (still posted to AR/AP — appears as a contact credit).
 *
 * Allocations are stored in payment_allocations so edits/deletes can reverse cleanly.
 */
export async function postPayment(paymentId: string): Promise<string> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Not authenticated");
  const userId = u.user.id;

  const { data: pay, error: pErr } = await supabase
    .from("payments").select("*").eq("id", paymentId).single();
  if (pErr || !pay) throw pErr ?? new Error("Payment not found");

  const amount = Number(pay.amount);
  if (amount <= 0) throw new Error("Amount must be greater than zero");
  if (!pay.account_id) throw new Error("Cash/Bank account is required");

  // Resolve contact-specific AR or AP sub-account based on direction
  const kind = pay.direction === "in" ? "ar" : "ap";
  const { data: subId, error: subErr } = await supabase
    .rpc("get_or_create_contact_account", { p_contact_id: pay.contact_id, p_kind: kind, p_company_id: pay.company_id });
  if (subErr || !subId) throw subErr ?? new Error("Could not resolve contact sub-account");
  const contactAccountId = subId as string;

  // Build the allocation plan
  type Alloc = { invoice_id?: string; bill_id?: string; amount: number; docNumber?: string };
  const allocations: Alloc[] = [];
  let allocatedTotal = 0;

  const linkedDocId = pay.direction === "in" ? pay.invoice_id : pay.bill_id;

  if (linkedDocId) {
    // Single-document mode (existing behavior)
    if (pay.direction === "in") {
      const { data: doc, error } = await supabase
        .from("invoices").select("invoice_number, total, paid_amount, status")
        .eq("id", linkedDocId).single();
      if (error || !doc) throw error ?? new Error("Invoice not found");
      if (doc.status === "draft") throw new Error("Cannot receive payment on a draft invoice");
      if (doc.status === "void") throw new Error("Invoice is void");
      const balance = Number(doc.total) - Number(doc.paid_amount);
      if (amount > balance + 0.0001) throw new Error(`Amount exceeds invoice balance (${balance.toFixed(2)})`);
      allocations.push({ invoice_id: linkedDocId, amount, docNumber: doc.invoice_number });
      allocatedTotal = amount;
    } else {
      const { data: doc, error } = await supabase
        .from("bills").select("bill_number, total, paid_amount, status")
        .eq("id", linkedDocId).single();
      if (error || !doc) throw error ?? new Error("Bill not found");
      if (doc.status === "draft") throw new Error("Cannot pay a draft bill");
      if (doc.status === "void") throw new Error("Bill is void");
      const balance = Number(doc.total) - Number(doc.paid_amount);
      if (amount > balance + 0.0001) throw new Error(`Amount exceeds bill balance (${balance.toFixed(2)})`);
      allocations.push({ bill_id: linkedDocId, amount, docNumber: doc.bill_number });
      allocatedTotal = amount;
    }
  } else {
    // On-account: auto-allocate FIFO across open/partial docs for this contact
    let remaining = amount;
    if (pay.direction === "in") {
      const { data: docs, error } = await supabase
        .from("invoices")
        .select("id, invoice_number, invoice_date, total, paid_amount")
        .eq("contact_id", pay.contact_id)
        .in("status", ["open", "partial"])
        .order("invoice_date", { ascending: true })
        .order("invoice_number", { ascending: true });
      if (error) throw error;
      for (const d of docs ?? []) {
        if (remaining <= 0.0001) break;
        const bal = Number(d.total) - Number(d.paid_amount);
        if (bal <= 0.0001) continue;
        const apply = Math.min(bal, remaining);
        allocations.push({ invoice_id: d.id, amount: apply, docNumber: d.invoice_number });
        remaining -= apply;
      }
    } else {
      const { data: docs, error } = await supabase
        .from("bills")
        .select("id, bill_number, bill_date, total, paid_amount")
        .eq("contact_id", pay.contact_id)
        .in("status", ["open", "partial"])
        .order("bill_date", { ascending: true })
        .order("bill_number", { ascending: true });
      if (error) throw error;
      for (const d of docs ?? []) {
        if (remaining <= 0.0001) break;
        const bal = Number(d.total) - Number(d.paid_amount);
        if (bal <= 0.0001) continue;
        const apply = Math.min(bal, remaining);
        allocations.push({ bill_id: d.id, amount: apply, docNumber: d.bill_number });
        remaining -= apply;
      }
    }
    allocatedTotal = amount - remaining;
    if (allocatedTotal <= 0.0001) {
      // Nothing to allocate — entire amount sits as on-account credit on the contact's AR/AP
      // (still post the JE so cash and AR/AP move; document statuses unchanged)
    }
  }

  // Idempotency: if already journaled (re-post), skip
  const { data: existing } = await supabase
    .from("journal_entries").select("id").eq("source_type", "payment").eq("source_id", pay.id).maybeSingle();
  if (existing) return existing.id;

  // Narration
  const docNums = allocations.map((a) => a.docNumber).filter(Boolean);
  const narration = pay.direction === "in"
    ? (docNums.length ? `Receipt for ${docNums.join(", ")}` : "On-account receipt")
    : (docNums.length ? `Payment for ${docNums.join(", ")}` : "On-account payment");

  // Create journal entry
  const { data: je, error: jeErr } = await supabase
    .from("journal_entries")
    .insert({
      user_id: userId,
      company_id: pay.company_id,
      entry_date: pay.payment_date,
      narration,
      reference: pay.reference || (docNums[0] ?? null),
      source_type: "payment",
      source_id: pay.id,
    })
    .select("id").single();
  if (jeErr || !je) throw jeErr ?? new Error("Could not create journal entry");

  const jLines: Array<{ account_id: string; debit: number; credit: number; description: string }> =
    pay.direction === "in"
      ? [
          { account_id: pay.account_id, debit: amount, credit: 0, description: "Cash/Bank received" },
          { account_id: contactAccountId, debit: 0, credit: amount, description: "Accounts receivable" },
        ]
      : [
          { account_id: contactAccountId, debit: amount, credit: 0, description: "Accounts payable" },
          { account_id: pay.account_id, debit: 0, credit: amount, description: "Cash/Bank paid" },
        ];

  const { error: jlErr } = await supabase.from("journal_lines").insert(
    jLines.map((l) => ({ ...l, user_id: userId, company_id: pay.company_id, entry_id: je.id, contact_id: pay.contact_id })),
  );
  if (jlErr) {
    await supabase.from("journal_entries").delete().eq("id", je.id);
    throw jlErr;
  }

  // Persist allocations and update each document's paid_amount/status
  if (allocations.length > 0) {
    const { error: paErr } = await supabase.from("payment_allocations").insert(
      allocations.map((a) => ({
        user_id: userId,
        company_id: pay.company_id,
        payment_id: pay.id,
        invoice_id: a.invoice_id ?? null,
        bill_id: a.bill_id ?? null,
        amount: a.amount,
      })),
    );
    if (paErr) {
      await supabase.from("journal_lines").delete().eq("entry_id", je.id);
      await supabase.from("journal_entries").delete().eq("id", je.id);
      throw paErr;
    }

    for (const a of allocations) {
      const tbl = a.invoice_id ? "invoices" : "bills";
      const id = (a.invoice_id ?? a.bill_id) as string;
      const { data: cur, error: curErr } = await supabase
        .from(tbl).select("total, paid_amount").eq("id", id).single();
      if (curErr || !cur) throw curErr ?? new Error("Could not reload document");
      const newPaid = Number(cur.paid_amount) + a.amount;
      const newStatus: "open" | "partial" | "paid" =
        newPaid + 0.0001 >= Number(cur.total) ? "paid" : newPaid > 0 ? "partial" : "open";
      const { error: upErr } = await supabase
        .from(tbl).update({ paid_amount: newPaid, status: newStatus }).eq("id", id);
      if (upErr) throw upErr;
    }
  }

  return je.id;
}

/**
 * Reverse a payment: deletes the journal entry/lines, reverses allocations
 * across all linked documents (restoring paid_amount/status), and removes
 * the allocation rows. Does NOT delete the payment row itself.
 */
export async function reversePayment(paymentId: string): Promise<void> {
  const { data: pay } = await supabase
    .from("payments").select("id, direction, invoice_id, bill_id, amount").eq("id", paymentId).single();
  if (!pay) return;

  // Delete journal entry + lines
  const { data: je } = await supabase
    .from("journal_entries").select("id")
    .eq("source_type", "payment").eq("source_id", paymentId).maybeSingle();
  if (je?.id) {
    await supabase.from("journal_lines").delete().eq("entry_id", je.id);
    await supabase.from("journal_entries").delete().eq("id", je.id);
  }

  // Reverse allocations
  const { data: allocs } = await supabase
    .from("payment_allocations").select("id, invoice_id, bill_id, amount").eq("payment_id", paymentId);

  if (allocs && allocs.length > 0) {
    for (const a of allocs) {
      const tbl = a.invoice_id ? "invoices" : a.bill_id ? "bills" : null;
      const id = (a.invoice_id ?? a.bill_id) as string | null;
      if (!tbl || !id) continue;
      const { data: cur } = await supabase.from(tbl).select("total, paid_amount").eq("id", id).single();
      if (cur) {
        const newPaid = Math.max(0, Number(cur.paid_amount) - Number(a.amount));
        const newStatus: "open" | "partial" | "paid" =
          newPaid + 0.0001 >= Number(cur.total) ? "paid" : newPaid > 0 ? "partial" : "open";
        await supabase.from(tbl).update({ paid_amount: newPaid, status: newStatus }).eq("id", id);
      }
    }
    await supabase.from("payment_allocations").delete().eq("payment_id", paymentId);
  } else {
    // Backwards compatibility for old payments created before allocations table existed:
    // fall back to the single linked document.
    const amt = Number(pay.amount);
    if (pay.direction === "in" && pay.invoice_id) {
      const { data: inv } = await supabase
        .from("invoices").select("total, paid_amount").eq("id", pay.invoice_id).single();
      if (inv) {
        const newPaid = Math.max(0, Number(inv.paid_amount) - amt);
        const newStatus: "open" | "partial" | "paid" =
          newPaid + 0.0001 >= Number(inv.total) ? "paid" : newPaid > 0 ? "partial" : "open";
        await supabase.from("invoices").update({ paid_amount: newPaid, status: newStatus }).eq("id", pay.invoice_id);
      }
    } else if (pay.direction === "out" && pay.bill_id) {
      const { data: bill } = await supabase
        .from("bills").select("total, paid_amount").eq("id", pay.bill_id).single();
      if (bill) {
        const newPaid = Math.max(0, Number(bill.paid_amount) - amt);
        const newStatus: "open" | "partial" | "paid" =
          newPaid + 0.0001 >= Number(bill.total) ? "paid" : newPaid > 0 ? "partial" : "open";
        await supabase.from("bills").update({ paid_amount: newPaid, status: newStatus }).eq("id", pay.bill_id);
      }
    }
  }
}

/**
 * Post an Expense:
 *  - Dr Expense category account (amount)
 *  - Cr Cash or Bank (amount)
 * Creates a balanced journal entry. Returns the journal entry id.
 */
export async function postExpense(expenseId: string): Promise<string> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Not authenticated");
  const userId = u.user.id;

  const { data: exp, error: eErr } = await supabase
    .from("expenses").select("*").eq("id", expenseId).single();
  if (eErr || !exp) throw eErr ?? new Error("Expense not found");

  const amount = Number(exp.amount);
  if (!(amount > 0)) throw new Error("Expense amount must be greater than zero");
  if (!exp.category_account_id) throw new Error("Category account is required");
  if (!exp.paid_from_account_id) throw new Error("Paid-from account is required");

  const { data: je, error: jeErr } = await supabase
    .from("journal_entries").insert({
      user_id: userId,
      company_id: exp.company_id,
      entry_date: exp.expense_date,
      reference: exp.reference || null,
      narration: exp.notes || "Expense",
      source_type: "expense",
      source_id: exp.id,
    }).select("id").single();
  if (jeErr || !je) throw jeErr ?? new Error("Could not create journal entry");

  const { error: jlErr } = await supabase.from("journal_lines").insert([
    {
      user_id: userId, company_id: exp.company_id, entry_id: je.id,
      account_id: exp.category_account_id,
      contact_id: exp.contact_id ?? null,
      debit: amount, credit: 0,
      description: exp.notes || "Expense",
    },
    {
      user_id: userId, company_id: exp.company_id, entry_id: je.id,
      account_id: exp.paid_from_account_id,
      contact_id: exp.contact_id ?? null,
      debit: 0, credit: amount,
      description: `Paid via ${exp.mode}`,
    },
  ]);
  if (jlErr) {
    await supabase.from("journal_entries").delete().eq("id", je.id);
    throw jlErr;
  }

  return je.id;
}
