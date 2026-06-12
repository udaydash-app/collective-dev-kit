import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, TrendingUp, Users, Printer, Receipt, X, Eye, FileText } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Contact { id: string; name: string; phone?: string; notes?: string }

interface TradeItem {
  id: string;
  supplier: string;
  description: string;
  packing: number;
  unit: string;
  bags: number;
  buy_price: number;
  tax: number;
  supplier_commission: number;
  sell_price: number;
  broker_commission: number;
}

interface TradeRecord {
  id: string;
  date: string;
  contact_id: string;
  contact_name: string;
  expenses: number;
  items: TradeItem[];
}

const STORAGE_KEY = "admin:trade-records";
const CONTACTS_KEY = "admin:trade-contacts";
const MIGRATED_KEY = "admin:trade-records:cloud-migrated-v1";
const PIN_KEY = "admin:trade-records:pin";
const UNLOCK_KEY = "admin:trade-records:unlocked";
const DEFAULT_PIN = "1111";

const emptyItem = (): TradeItem => ({
  id: crypto.randomUUID(),
  supplier: "",
  description: "",
  packing: 0,
  unit: "kg",
  bags: 1,
  buy_price: 0,
  tax: 0,
  supplier_commission: 0,
  sell_price: 0,
  broker_commission: 0,
});

const emptyForm = {
  date: new Date().toISOString().slice(0, 10),
  contact_id: "",
  expenses: "0",
  items: [emptyItem()] as TradeItem[],
};

const itemBuy = (i: TradeItem) =>
  ((i.buy_price || 0) + (i.tax || 0) + (i.supplier_commission || 0) + (i.broker_commission || 0)) * (i.bags || 0);

const itemSell = (i: TradeItem) => (i.sell_price || 0) * (i.bags || 0);

const totalBuy = (r: TradeRecord) => (r.items || []).reduce((s, i) => s + itemBuy(i), 0);
const totalSell = (r: TradeRecord) => (r.items || []).reduce((s, i) => s + itemSell(i), 0);
const totalBags = (r: TradeRecord) => (r.items || []).reduce((s, i) => s + (i.bags || 0), 0);
const sumBy = <T,>(arr: T[], f: (x: T) => number) => arr.reduce((s, x) => s + (f(x) || 0), 0);
const totalBrokerComm = (r: TradeRecord) => sumBy(r.items || [], (i) => (i.broker_commission || 0) * (i.bags || 0));
const totalSupplierComm = (r: TradeRecord) => sumBy(r.items || [], (i) => (i.supplier_commission || 0) * (i.bags || 0));
const profitOf = (r: TradeRecord) => totalSell(r) - totalBuy(r) - (r.expenses || 0);

// Migrate legacy single-product records to items[] shape
const migrate = (raw: any): TradeRecord => {
  if (raw && Array.isArray(raw.items)) {
    // backfill supplier onto items if missing (older multi-item records)
    const recSup = raw.supplier ?? "";
    return {
      ...raw,
      items: raw.items.map((i: any) => ({ ...i, supplier: i.supplier ?? recSup })),
    } as TradeRecord;
  }
  return {
    id: raw.id ?? crypto.randomUUID(),
    date: raw.date,
    contact_id: raw.contact_id,
    contact_name: raw.contact_name ?? "",
    expenses: Number(raw.expenses) || 0,
    items: [{
      id: crypto.randomUUID(),
      supplier: raw.supplier ?? "",
      description: raw.description ?? "",
      packing: Number(raw.packing) || 0,
      unit: raw.unit ?? "kg",
      bags: Number(raw.bags) || 0,
      buy_price: Number(raw.buy_price) || 0,
      tax: Number(raw.tax) || 0,
      supplier_commission: Number(raw.supplier_commission) || 0,
      sell_price: Number(raw.sell_price) || 0,
      broker_commission: Number(raw.broker_commission) || 0,
    }],
  };
};

const fmt = (n: number) => new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

type PeriodKey = "this_month" | "last_month" | "this_year" | "last_7" | "last_30" | "all" | "custom";

const periodRange = (key: PeriodKey, fromStr: string, toStr: string): { from?: string; to?: string } => {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  switch (key) {
    case "this_month":
      return { from: iso(new Date(y, m, 1)), to: iso(new Date(y, m + 1, 0)) };
    case "last_month":
      return { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) };
    case "this_year":
      return { from: iso(new Date(y, 0, 1)), to: iso(new Date(y, 11, 31)) };
    case "last_7": {
      const d = startOfDay(today); d.setDate(d.getDate() - 6);
      return { from: iso(d), to: iso(today) };
    }
    case "last_30": {
      const d = startOfDay(today); d.setDate(d.getDate() - 29);
      return { from: iso(d), to: iso(today) };
    }
    case "custom":
      return { from: fromStr || undefined, to: toStr || undefined };
    case "all":
    default:
      return {};
  }
};

const TradeRecords = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [records, setRecords] = useState<TradeRecord[]>([]);
  const [filterContact, setFilterContact] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TradeRecord | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [contactsOpen, setContactsOpen] = useState(false);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [contactForm, setContactForm] = useState({ name: "", phone: "", notes: "" });
  const [period, setPeriod] = useState<PeriodKey>("this_month");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");
  const [commissionsOpen, setCommissionsOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  // Internal PIN gate removed — the entire External folder is PIN-locked at the Desktop level.
  const [unlocked, setUnlocked] = useState<boolean>(true);
  const [pinInput, setPinInput] = useState("");
  const [changePinOpen, setChangePinOpen] = useState(false);
  const [pinForm, setPinForm] = useState({ current: "", next: "", confirm: "" });

  const getStoredPin = () => localStorage.getItem(PIN_KEY) || DEFAULT_PIN;

  useEffect(() => {
    const storedPin = localStorage.getItem(PIN_KEY);
    if (!storedPin || storedPin === "1234") localStorage.setItem(PIN_KEY, DEFAULT_PIN);
  }, []);

  const tryUnlock = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (pinInput === getStoredPin()) {
      sessionStorage.setItem(UNLOCK_KEY, "1");
      setUnlocked(true);
      setPinInput("");
    } else {
      toast.error("Incorrect PIN");
      setPinInput("");
    }
  };

  const lock = () => {
    sessionStorage.removeItem(UNLOCK_KEY);
    setUnlocked(false);
  };

  const saveNewPin = () => {
    if (pinForm.current !== getStoredPin()) { toast.error("Current PIN is incorrect"); return; }
    if (!/^\d{4,8}$/.test(pinForm.next)) { toast.error("New PIN must be 4-8 digits"); return; }
    if (pinForm.next !== pinForm.confirm) { toast.error("PINs do not match"); return; }
    localStorage.setItem(PIN_KEY, pinForm.next);
    setPinForm({ current: "", next: "", confirm: "" });
    setChangePinOpen(false);
    toast.success("PIN updated");
  };

  useEffect(() => {
    // Show local cache instantly, then refresh from cloud.
    try {
      const raw = localStorage.getItem(CONTACTS_KEY);
      setContacts(raw ? JSON.parse(raw) : []);
    } catch { setContacts([]); }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      setRecords(Array.isArray(parsed) ? parsed.map(migrate) : []);
    } catch { setRecords([]); }
    void loadFromCloud();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadFromCloud = async () => {
    try {
      const [{ data: cData, error: cErr }, { data: rData, error: rErr }] = await Promise.all([
        supabase.from("trade_contacts" as any).select("*").order("name", { ascending: true }),
        supabase.from("trade_records" as any).select("*").order("record_date", { ascending: false }),
      ]);
      if (cErr) throw cErr;
      if (rErr) throw rErr;

      const cloudContacts: Contact[] = (cData ?? []).map((c: any) => ({
        id: c.id, name: c.name, phone: c.phone ?? undefined, notes: c.notes ?? undefined,
      }));
      const cloudRecords: TradeRecord[] = (rData ?? []).map((r: any) => ({
        id: r.id,
        date: r.record_date,
        contact_id: r.contact_id ?? "",
        contact_name: r.contact_name ?? "",
        expenses: Number(r.expenses) || 0,
        items: Array.isArray(r.items) ? r.items : [],
      }));

      // One-time migration: push local data up if cloud is empty and we haven't migrated yet.
      if (!localStorage.getItem(MIGRATED_KEY) && cloudContacts.length === 0 && cloudRecords.length === 0) {
        await migrateLocalToCloud();
        localStorage.setItem(MIGRATED_KEY, "1");
        return loadFromCloud();
      }

      setContacts(cloudContacts);
      setRecords(cloudRecords);
      localStorage.setItem(CONTACTS_KEY, JSON.stringify(cloudContacts));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cloudRecords));
      localStorage.setItem(MIGRATED_KEY, "1");
    } catch (e: any) {
      console.warn("[TradeRecords] cloud load failed, using local cache:", e?.message ?? e);
    }
  };

  const migrateLocalToCloud = async () => {
    try {
      const rawC = localStorage.getItem(CONTACTS_KEY);
      const rawR = localStorage.getItem(STORAGE_KEY);
      const localContacts: Contact[] = rawC ? JSON.parse(rawC) : [];
      const localRecords: TradeRecord[] = rawR ? (JSON.parse(rawR) as any[]).map(migrate) : [];
      if (localContacts.length) {
        await supabase.from("trade_contacts" as any).insert(
          localContacts.map((c) => ({ id: c.id, name: c.name, phone: c.phone ?? null, notes: c.notes ?? null }))
        );
      }
      if (localRecords.length) {
        await supabase.from("trade_records" as any).insert(
          localRecords.map((r) => ({
            id: r.id,
            record_date: r.date,
            contact_id: r.contact_id || null,
            contact_name: r.contact_name ?? "",
            expenses: r.expenses ?? 0,
            items: r.items ?? [],
          }))
        );
      }
      if (localContacts.length || localRecords.length) {
        toast.success("Trade records synced to cloud");
      }
    } catch (e: any) {
      console.warn("[TradeRecords] migration failed:", e?.message ?? e);
    }
  };

  const persist = (next: TradeRecord[]) => {
    setRecords(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const persistContacts = (next: Contact[]) => {
    setContacts(next);
    localStorage.setItem(CONTACTS_KEY, JSON.stringify(next));
  };

  const openNewContact = () => {
    setEditingContact(null);
    setContactForm({ name: "", phone: "", notes: "" });
    setContactDialogOpen(true);
  };

  const openEditContact = (c: Contact) => {
    setEditingContact(c);
    setContactForm({ name: c.name, phone: c.phone ?? "", notes: c.notes ?? "" });
    setContactDialogOpen(true);
  };

  const saveContact = () => {
    if (!contactForm.name.trim()) { toast.error("Name is required"); return; }
    const next: Contact = {
      id: editingContact?.id ?? crypto.randomUUID(),
      name: contactForm.name.trim(),
      phone: contactForm.phone.trim() || undefined,
      notes: contactForm.notes.trim() || undefined,
    };
    const updated = editingContact
      ? contacts.map((c) => (c.id === editingContact.id ? next : c))
      : [...contacts, next];
    persistContacts(updated.sort((a, b) => a.name.localeCompare(b.name)));
    setContactDialogOpen(false);
    toast.success(editingContact ? "Contact updated" : "Contact added");
    // Cloud sync
    void supabase.from("trade_contacts" as any).upsert({
      id: next.id,
      name: next.name,
      phone: next.phone ?? null,
      notes: next.notes ?? null,
    }).then(({ error }) => {
      if (error) toast.error("Cloud sync failed: " + error.message);
    });
  };

  const removeContact = (id: string) => {
    const used = records.some((r) => r.contact_id === id);
    if (used && !confirm("This contact has trade records. Delete anyway? Records will keep the contact name.")) return;
    if (!used && !confirm("Delete this contact?")) return;
    persistContacts(contacts.filter((c) => c.id !== id));
    void supabase.from("trade_contacts" as any).delete().eq("id", id).then(({ error }) => {
      if (error) toast.error("Cloud sync failed: " + error.message);
    });
  };

  const { from: rangeFrom, to: rangeTo } = useMemo(
    () => periodRange(period, customFrom, customTo),
    [period, customFrom, customTo]
  );

  const inRange = (date: string) =>
    (!rangeFrom || date >= rangeFrom) && (!rangeTo || date <= rangeTo);

  const filtered = useMemo(() => {
    const list = records.filter((r) =>
      (filterContact === "all" || r.contact_id === filterContact) && inRange(r.date)
    );
    return [...list].sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [records, filterContact, rangeFrom, rangeTo]);

  const totals = useMemo(() => filtered.reduce(
    (acc, r) => {
      acc.buy += totalBuy(r);
      acc.sell += totalSell(r);
      acc.profit += profitOf(r);
      return acc;
    }, { buy: 0, sell: 0, profit: 0 }
  ), [filtered]);

  const summaryFor = (key: PeriodKey) => {
    const { from, to } = periodRange(key, "", "");
    const list = records.filter((r) =>
      (filterContact === "all" || r.contact_id === filterContact) &&
      (!from || r.date >= from) && (!to || r.date <= to)
    );
    return list.reduce(
      (acc, r) => {
        acc.turnover += totalSell(r);
        acc.profit += profitOf(r);
        acc.count += 1;
        return acc;
      },
      { turnover: 0, profit: 0, count: 0 }
    );
  };

  const thisMonth = useMemo(() => summaryFor("this_month"), [records, filterContact]);
  const lastMonth = useMemo(() => summaryFor("last_month"), [records, filterContact]);
  const thisYear = useMemo(() => summaryFor("this_year"), [records, filterContact]);
  const allTime = useMemo(() => summaryFor("all"), [records, filterContact]);

  const openNew = () => {
    setEditing(null);
    setForm({ ...emptyForm, contact_id: filterContact !== "all" ? filterContact : (contacts[0]?.id ?? "") });
    setOpen(true);
  };

  const openEdit = (r: TradeRecord) => {
    setEditing(r);
    setForm({
      date: r.date,
      contact_id: r.contact_id,
      expenses: String(r.expenses),
      items: r.items.map((i) => ({ ...i })),
    });
    setOpen(true);
  };

  const save = () => {
    if (!form.contact_id) { toast.error("Select a contact"); return; }
    if (!form.date) { toast.error("Date is required"); return; }
    if (!form.items.length) { toast.error("Add at least one product"); return; }
    const contact = contacts.find((c) => c.id === form.contact_id);
    const next: TradeRecord = {
      id: editing?.id ?? crypto.randomUUID(),
      date: form.date,
      contact_id: form.contact_id,
      contact_name: contact?.name ?? "",
      expenses: Number(form.expenses) || 0,
      items: form.items.map((i) => ({
        ...i,
        supplier: (i.supplier || "").trim(),
        description: (i.description || "").trim(),
        unit: i.unit || "kg",
        packing: Number(i.packing) || 0,
        bags: Number(i.bags) || 0,
        buy_price: Number(i.buy_price) || 0,
        tax: Number(i.tax) || 0,
        supplier_commission: Number(i.supplier_commission) || 0,
        sell_price: Number(i.sell_price) || 0,
        broker_commission: Number(i.broker_commission) || 0,
      })),
    };
    persist(editing ? records.map((r) => (r.id === editing.id ? next : r)) : [next, ...records]);
    setOpen(false);
    toast.success(editing ? "Record updated" : "Record added");
    // Cloud sync
    void supabase.from("trade_records" as any).upsert({
      id: next.id,
      record_date: next.date,
      contact_id: next.contact_id || null,
      contact_name: next.contact_name ?? "",
      expenses: next.expenses ?? 0,
      items: next.items ?? [],
    }).then(({ error }) => {
      if (error) toast.error("Cloud sync failed: " + error.message);
    });
  };

  const remove = (id: string) => {
    if (!confirm("Delete this record?")) return;
    persist(records.filter((r) => r.id !== id));
    void supabase.from("trade_records" as any).delete().eq("id", id).then(({ error }) => {
      if (error) toast.error("Cloud sync failed: " + error.message);
    });
  };

  const contactName = (id: string) =>
    contacts.find((c) => c.id === id)?.name ?? records.find((r) => r.contact_id === id)?.contact_name ?? "—";

  const handlePrint = () => {
    const esc = (s: string) =>
      String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as any)[c]);
    const periodLabel: Record<PeriodKey, string> = {
      this_month: "This Month", last_month: "Last Month", this_year: "This Year",
      last_7: "Last 7 Days", last_30: "Last 30 Days", all: "All Time", custom: "Custom Range",
    };
    const rangeText = rangeFrom || rangeTo
      ? `${rangeFrom ?? "…"} → ${rangeTo ?? "…"}`
      : "All dates";
    const contactLabel = filterContact === "all" ? "All Contacts" : contactName(filterContact);

    const groups = new Map<string, TradeRecord[]>();
    for (const r of filtered) {
      const key = r.contact_id;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    }

    const renderGroup = (cid: string, rows: TradeRecord[]) => {
      const sub = rows.reduce(
        (a, r) => {
          a.buy += totalBuy(r);
          a.sell += totalSell(r);
          a.profit += profitOf(r);
          return a;
        },
        { buy: 0, sell: 0, profit: 0 }
      );
      const sorted = [...rows].sort((a, b) => (a.date < b.date ? -1 : 1));
      return `
        <h2>${esc(contactName(cid))}</h2>
        <table>
          <thead>
            <tr>
              <th>Date</th><th>Supplier</th><th>Products</th>
              <th class="r">Bags</th><th class="r">Total Buy</th>
              <th class="r">Total Sell</th><th class="r">Exps</th><th class="r">Profit</th>
            </tr>
          </thead>
          <tbody>
            ${sorted.map((r) => {
              const p = profitOf(r);
              const suppliers = Array.from(new Set(r.items.map(i => (i.supplier || "").trim()).filter(Boolean))).join(", ") || "—";
              const itemsHtml = r.items.map((i) =>
                `${esc(i.description || "—")}${i.supplier ? ` <i style="color:#666">[${esc(i.supplier)}]</i>` : ""} (${fmt(i.bags)} × ${fmt(i.buy_price)} → ${fmt(i.sell_price)})`
              ).join("<br/>");
              return `<tr>
                <td>${esc(r.date)}</td>
                <td>${esc(suppliers)}</td>
                <td>${itemsHtml}</td>
                <td class="r">${fmt(totalBags(r))}</td>
                <td class="r">${fmt(totalBuy(r))}</td>
                <td class="r">${fmt(totalSell(r))}</td>
                <td class="r">${fmt(r.expenses)}</td>
                <td class="r ${p >= 0 ? "pos" : "neg"}">${fmt(p)}</td>
              </tr>`;
            }).join("")}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="4" class="r"><b>Subtotal</b></td>
              <td class="r"><b>${fmt(sub.buy)}</b></td>
              <td class="r"><b>${fmt(sub.sell)}</b></td>
              <td class="r"></td>
              <td class="r ${sub.profit >= 0 ? "pos" : "neg"}"><b>${fmt(sub.profit)}</b></td>
            </tr>
          </tfoot>
        </table>
      `;
    };

    const groupsHtml = filterContact === "all"
      ? [...groups.entries()]
          .sort((a, b) => contactName(a[0]).localeCompare(contactName(b[0])))
          .map(([cid, rows]) => renderGroup(cid, rows)).join("")
      : renderGroup(filterContact, filtered);

    // Commission summaries
    const brokerByContact = new Map<string, number>();
    const supplierBySupplier = new Map<string, number>();
    for (const r of filtered) {
      brokerByContact.set(r.contact_id, (brokerByContact.get(r.contact_id) || 0) + totalBrokerComm(r));
      for (const i of r.items) {
        const sup = (i.supplier || "—").trim() || "—";
        supplierBySupplier.set(sup, (supplierBySupplier.get(sup) || 0) + (i.supplier_commission || 0) * (i.bags || 0));
      }
    }
    const brokerRows = [...brokerByContact.entries()]
      .filter(([, v]) => v !== 0)
      .sort((a, b) => contactName(a[0]).localeCompare(contactName(b[0])))
      .map(([cid, v]) => `<tr><td>${esc(contactName(cid))}</td><td class="r">${fmt(v)}</td></tr>`).join("");
    const supplierRows = [...supplierBySupplier.entries()]
      .filter(([, v]) => v !== 0)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([s, v]) => `<tr><td>${esc(s)}</td><td class="r">${fmt(v)}</td></tr>`).join("");
    const brokerTotal = [...brokerByContact.values()].reduce((a, b) => a + b, 0);
    const supplierTotal = [...supplierBySupplier.values()].reduce((a, b) => a + b, 0);
    const commissionsHtml = `
      <h2>Commissions Summary</h2>
      <div style="display:flex; gap:24px; align-items:flex-start;">
        <div style="flex:1">
          <h3 style="font-size:12px;margin:4px 0">Broker Commission (paid to contact)</h3>
          <table><thead><tr><th>Contact</th><th class="r">Amount</th></tr></thead>
            <tbody>${brokerRows || '<tr><td colspan="2" style="text-align:center;color:#777">None</td></tr>'}</tbody>
            <tfoot><tr><td class="r"><b>Total</b></td><td class="r"><b>${fmt(brokerTotal)}</b></td></tr></tfoot>
          </table>
        </div>
        <div style="flex:1">
          <h3 style="font-size:12px;margin:4px 0">Supplier Commission (paid to supplier)</h3>
          <table><thead><tr><th>Supplier</th><th class="r">Amount</th></tr></thead>
            <tbody>${supplierRows || '<tr><td colspan="2" style="text-align:center;color:#777">None</td></tr>'}</tbody>
            <tfoot><tr><td class="r"><b>Total</b></td><td class="r"><b>${fmt(supplierTotal)}</b></td></tr></tfoot>
          </table>
        </div>
      </div>`;

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Trade Ledger</title>
      <style>
        * { box-sizing: border-box; }
        body { font: 12px/1.4 -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #111; margin: 24px; }
        h1 { margin: 0 0 4px; font-size: 20px; }
        h2 { margin: 24px 0 8px; font-size: 14px; border-bottom: 1px solid #999; padding-bottom: 4px; }
        .meta { color: #555; margin-bottom: 16px; font-size: 11px; }
        .meta span { margin-right: 16px; }
        .totals { margin-top: 16px; padding: 10px 12px; border: 1px solid #ccc; background: #f7f7f7; display: flex; gap: 24px; font-size: 12px; }
        .totals b { font-size: 13px; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        th, td { border: 1px solid #ddd; padding: 4px 6px; }
        th { background: #f1f1f1; text-align: left; }
        .r { text-align: right; }
        .pos { color: #15803d; }
        .neg { color: #b91c1c; }
        tfoot td { background: #fafafa; }
        @media print { body { margin: 12mm; } h2 { page-break-after: avoid; } table { page-break-inside: auto; } tr { page-break-inside: avoid; } }
      </style></head><body>
      <h1>Trade Ledger</h1>
      <div class="meta">
        <span><b>Contact:</b> ${esc(contactLabel)}</span>
        <span><b>Period:</b> ${esc(periodLabel[period])} (${esc(rangeText)})</span>
        <span><b>Printed:</b> ${new Date().toLocaleString()}</span>
      </div>
      ${filtered.length === 0 ? "<p>No records in selected range.</p>" : groupsHtml + commissionsHtml}
      <div class="totals">
        <div>Total Buy: <b>${fmt(totals.buy)}</b></div>
        <div>Turnover: <b>${fmt(totals.sell)}</b></div>
        <div>Profit: <b class="${totals.profit >= 0 ? "pos" : "neg"}">${fmt(totals.profit)}</b></div>
        <div>Records: <b>${filtered.length}</b></div>
      </div>
      <script>window.onload = () => { setTimeout(() => window.print(), 250); };</script>
      </body></html>`;

    const w = window.open("", "_blank");
    if (!w) { toast.error("Allow popups to print"); return; }
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  return (
    <div className="min-h-screen bg-background">
      {!unlocked && (
        <div className="fixed inset-0 z-[2147483600] flex items-center justify-center bg-background/95 backdrop-blur p-4">
          <form onSubmit={tryUnlock} className="w-full max-w-sm bg-card border border-border rounded-lg p-6 shadow-lg space-y-4">
            <div className="text-center space-y-1">
              <div className="mx-auto h-10 w-10 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                <TrendingUp className="h-5 w-5" />
              </div>
              <h2 className="text-lg font-semibold">Trade Records Locked</h2>
              <p className="text-xs text-muted-foreground">Enter PIN to continue (default: {DEFAULT_PIN})</p>
            </div>
            <Input
              type="password"
              inputMode="numeric"
              autoFocus
              placeholder="PIN"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              className="text-center tracking-widest text-lg"
            />
            <Button type="submit" className="w-full">Unlock</Button>
          </form>
        </div>
      )}
      <header className="border-b border-border bg-card">
        <div className="px-4 md:px-6 py-4 md:py-5 flex flex-col md:flex-row md:items-start md:justify-between gap-3 md:gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-md bg-primary/10 text-primary flex items-center justify-center">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Trade Records</h1>
              <p className="text-xs md:text-sm text-muted-foreground">Contact-wise trade ledger with profit tracking</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />Print / PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCommissionsOpen(true)}>
              <Receipt className="h-4 w-4 mr-2" />Commissions
            </Button>
            <Button variant="outline" size="sm" onClick={() => setContactsOpen(true)}>
              <Users className="h-4 w-4 mr-2" />Contacts
            </Button>
            <Button variant="outline" size="sm" onClick={() => setChangePinOpen(true)}>
              Change PIN
            </Button>
            <Button variant="outline" size="sm" onClick={lock}>
              Lock
            </Button>
            <Button size="sm" onClick={openNew} disabled={!contacts.length}>
              <Plus className="h-4 w-4 mr-2" />New Record
            </Button>
          </div>
        </div>
      </header>

      <div className="p-6 space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          {([
            ["This Month", thisMonth],
            ["Last Month", lastMonth],
            ["This Year", thisYear],
            ["All Time", allTime],
          ] as const).map(([label, s]) => (
            <Card key={label} className="p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-xs text-muted-foreground">Turnover</span>
                <span className="font-semibold">{fmt(s.turnover)}</span>
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-xs text-muted-foreground">Profit</span>
                <span className={"font-semibold " + (s.profit >= 0 ? "text-green-600" : "text-red-600")}>{fmt(s.profit)}</span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{s.count} record{s.count === 1 ? "" : "s"}</div>
            </Card>
          ))}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="w-64">
            <Label className="text-xs">Filter by contact</Label>
            <Select value={filterContact} onValueChange={setFilterContact}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All contacts</SelectItem>
                {contacts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-48">
            <Label className="text-xs">Period</Label>
            <Select value={period} onValueChange={(v) => setPeriod(v as PeriodKey)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="this_month">This month</SelectItem>
                <SelectItem value="last_month">Last month</SelectItem>
                <SelectItem value="last_7">Last 7 days</SelectItem>
                <SelectItem value="last_30">Last 30 days</SelectItem>
                <SelectItem value="this_year">This year</SelectItem>
                <SelectItem value="all">All time</SelectItem>
                <SelectItem value="custom">Custom range</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {period === "custom" && (
            <>
              <div>
                <Label className="text-xs">From</Label>
                <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">To</Label>
                <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
              </div>
            </>
          )}
          <div className="ml-auto flex gap-4 text-sm">
            <div><span className="text-muted-foreground">Buy: </span><span className="font-medium">{fmt(totals.buy)}</span></div>
            <div><span className="text-muted-foreground">Turnover: </span><span className="font-medium">{fmt(totals.sell)}</span></div>
            <div><span className="text-muted-foreground">Profit: </span><span className={totals.profit >= 0 ? "font-semibold text-green-600" : "font-semibold text-red-600"}>{fmt(totals.profit)}</span></div>
          </div>
        </div>

        <Card>
          <Table fixedScroll>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Supplier(s)</TableHead>
                <TableHead>Products</TableHead>
                <TableHead className="text-right">Bags</TableHead>
                <TableHead className="text-right">Total Buy</TableHead>
                <TableHead className="text-right">Total Sell</TableHead>
                <TableHead className="text-right">Exps</TableHead>
                <TableHead className="text-right">Profit</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-10">No records yet</TableCell></TableRow>
              ) : filtered.map((r) => {
                const profit = profitOf(r);
                const suppliers = Array.from(new Set(r.items.map(i => (i.supplier || "").trim()).filter(Boolean))).join(", ") || "—";
                return (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap">{r.date}</TableCell>
                    <TableCell className="whitespace-nowrap">{contactName(r.contact_id)}</TableCell>
                    <TableCell className="whitespace-nowrap max-w-[200px] truncate" title={suppliers}>{suppliers}</TableCell>
                    <TableCell className="max-w-[320px]">
                      <div className="space-y-0.5 text-xs">
                        {r.items.map((i) => (
                          <div key={i.id} className="truncate">
                            <span className="font-medium">{i.description || "—"}</span>
                            {i.supplier ? <span className="text-muted-foreground"> [{i.supplier}]</span> : null}
                            <span className="text-muted-foreground"> · {fmt(i.bags)} {i.unit} · buy {fmt(i.buy_price)} → sell {fmt(i.sell_price)}</span>
                          </div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{fmt(totalBags(r))}</TableCell>
                    <TableCell className="text-right font-medium">{fmt(totalBuy(r))}</TableCell>
                    <TableCell className="text-right">{fmt(totalSell(r))}</TableCell>
                    <TableCell className="text-right">{fmt(r.expenses)}</TableCell>
                    <TableCell className={"text-right font-semibold " + (profit >= 0 ? "text-green-600" : "text-red-600")}>{fmt(profit)}</TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>

        {!contacts.length && (
          <p className="text-sm text-muted-foreground">
            No contacts yet. <button className="underline" onClick={openNewContact}>Add your first contact</button> to start recording trades.
          </p>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit" : "New"} Trade Record</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Date</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
              <div>
                <Label>Contact</Label>
                <Select value={form.contact_id} onValueChange={(v) => setForm({ ...form, contact_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select contact" /></SelectTrigger>
                  <SelectContent>
                    {contacts.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base">Products</Label>
                <Button type="button" size="sm" variant="outline"
                  onClick={() => setForm({ ...form, items: [...form.items, emptyItem()] })}>
                  <Plus className="h-4 w-4 mr-1" />Add product
                </Button>
              </div>
              {form.items.map((it, idx) => {
                const updateItem = (patch: Partial<TradeItem>) => {
                  const next = form.items.map((x, i) => i === idx ? { ...x, ...patch } : x);
                  setForm({ ...form, items: next });
                };
                const removeItem = () => {
                  if (form.items.length === 1) { toast.error("At least one product is required"); return; }
                  setForm({ ...form, items: form.items.filter((_, i) => i !== idx) });
                };
                return (
                  <div key={it.id} className="rounded-md border p-3 space-y-2 relative">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">Product #{idx + 1}</span>
                      <Button type="button" size="icon" variant="ghost" onClick={removeItem}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <div className="col-span-2 md:col-span-2">
                        <Label className="text-xs">Supplier</Label>
                        <Input value={it.supplier} onChange={(e) => updateItem({ supplier: e.target.value })} placeholder="Supplier name" />
                      </div>
                      <div className="col-span-2 md:col-span-2">
                        <Label className="text-xs">Description</Label>
                        <Input value={it.description} onChange={(e) => updateItem({ description: e.target.value })} />
                      </div>
                      <div>
                        <Label className="text-xs">Packing</Label>
                        <Input type="number" step="0.01" value={String(it.packing)} onChange={(e) => updateItem({ packing: Number(e.target.value) || 0 })} />
                      </div>
                      <div>
                        <Label className="text-xs">Unit</Label>
                        <Select value={it.unit} onValueChange={(v) => updateItem({ unit: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {["kg", "g", "ltr", "ml", "pcs", "dozen", "bag", "box"].map((u) => (
                              <SelectItem key={u} value={u}>{u}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Bags</Label>
                        <Input type="number" step="1" value={String(it.bags)} onChange={(e) => updateItem({ bags: Number(e.target.value) || 0 })} />
                      </div>
                      <div>
                        <Label className="text-xs">Buy Price /bag</Label>
                        <Input type="number" step="0.01" value={String(it.buy_price)} onChange={(e) => updateItem({ buy_price: Number(e.target.value) || 0 })} />
                      </div>
                      <div>
                        <Label className="text-xs">Tax /bag</Label>
                        <Input type="number" step="0.01" value={String(it.tax)} onChange={(e) => updateItem({ tax: Number(e.target.value) || 0 })} />
                      </div>
                      <div>
                        <Label className="text-xs">Sup. Comm /bag</Label>
                        <Input type="number" step="0.01" value={String(it.supplier_commission)} onChange={(e) => updateItem({ supplier_commission: Number(e.target.value) || 0 })} />
                      </div>
                      <div>
                        <Label className="text-xs">Brk. Comm /bag</Label>
                        <Input type="number" step="0.01" value={String(it.broker_commission)} onChange={(e) => updateItem({ broker_commission: Number(e.target.value) || 0 })} />
                      </div>
                      <div>
                        <Label className="text-xs">Sell Price /bag</Label>
                        <Input type="number" step="0.01" value={String(it.sell_price)} onChange={(e) => updateItem({ sell_price: Number(e.target.value) || 0 })} />
                      </div>
                      <div className="md:col-span-3 flex items-end justify-end gap-4 text-xs">
                        <span>Buy: <b>{fmt(itemBuy(it))}</b></span>
                        <span>Sell: <b>{fmt(itemSell(it))}</b></span>
                        <span>Line profit: <b>{fmt(itemSell(it) - itemBuy(it))}</b></span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Expenses (total)</Label>
                <Input type="number" step="0.01" value={form.expenses} onChange={(e) => setForm({ ...form, expenses: e.target.value })} />
              </div>
            </div>

            <div className="rounded-md bg-muted px-3 py-2 text-sm flex justify-between flex-wrap gap-2">
              {(() => {
                const tb = form.items.reduce((s, i) => s + itemBuy(i), 0);
                const ts = form.items.reduce((s, i) => s + itemSell(i), 0);
                const p = ts - tb - (Number(form.expenses) || 0);
                return (
                  <>
                    <span>Total Buy: <b>{fmt(tb)}</b></span>
                    <span>Total Sell: <b>{fmt(ts)}</b></span>
                    <span>Expenses: <b>{fmt(Number(form.expenses) || 0)}</b></span>
                    <span>Profit: <b className={p >= 0 ? "text-green-600" : "text-red-600"}>{fmt(p)}</b></span>
                  </>
                );
              })()}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>{editing ? "Update" : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={contactsOpen} onOpenChange={setContactsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-4">
              <span>Trade Contacts</span>
              <Button size="sm" onClick={openNewContact}>
                <Plus className="h-4 w-4 mr-1" />Add Contact
              </Button>
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">No contacts yet</TableCell></TableRow>
                ) : contacts.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c.phone ?? "—"}</TableCell>
                    <TableCell className="max-w-[240px] truncate">{c.notes ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" onClick={() => openEditContact(c)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => removeContact(c.id)}><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={contactDialogOpen} onOpenChange={setContactDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingContact ? "Edit" : "New"} Contact</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name *</Label>
              <Input value={contactForm.name} onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })} />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={contactForm.phone} onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })} />
            </div>
            <div>
              <Label>Notes</Label>
              <Input value={contactForm.notes} onChange={(e) => setContactForm({ ...contactForm, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setContactDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveContact}>{editingContact ? "Update" : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={commissionsOpen} onOpenChange={setCommissionsOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-4">
              <span>Commissions Summary</span>
              <Button size="sm" variant="outline" onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-1" />Print
              </Button>
            </DialogTitle>
          </DialogHeader>
          {(() => {
            const brokerByContact = new Map<string, number>();
            const supplierBySupplier = new Map<string, number>();
            for (const r of filtered) {
              brokerByContact.set(r.contact_id, (brokerByContact.get(r.contact_id) || 0) + totalBrokerComm(r));
              for (const i of r.items) {
                const sup = (i.supplier || "—").trim() || "—";
                supplierBySupplier.set(sup, (supplierBySupplier.get(sup) || 0) + (i.supplier_commission || 0) * (i.bags || 0));
              }
            }
            const brokerList = [...brokerByContact.entries()].filter(([, v]) => v !== 0)
              .sort((a, b) => contactName(a[0]).localeCompare(contactName(b[0])));
            const supplierList = [...supplierBySupplier.entries()].filter(([, v]) => v !== 0)
              .sort((a, b) => a[0].localeCompare(b[0]));
            const brokerTotal = brokerList.reduce((a, [, v]) => a + v, 0);
            const supplierTotal = supplierList.reduce((a, [, v]) => a + v, 0);
            return (
              <div className="grid md:grid-cols-2 gap-4 max-h-[60vh] overflow-auto">
                <div>
                  <div className="text-sm font-medium mb-2">Broker Commission (paid to contact)</div>
                  <Table>
                    <TableHeader><TableRow><TableHead>Contact</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {brokerList.length === 0 ? (
                        <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground py-4">None</TableCell></TableRow>
                      ) : brokerList.map(([cid, v]) => (
                        <TableRow key={cid}><TableCell>{contactName(cid)}</TableCell><TableCell className="text-right">{fmt(v)}</TableCell></TableRow>
                      ))}
                      <TableRow><TableCell className="font-semibold">Total</TableCell><TableCell className="text-right font-semibold">{fmt(brokerTotal)}</TableCell></TableRow>
                    </TableBody>
                  </Table>
                </div>
                <div>
                  <div className="text-sm font-medium mb-2">Supplier Commission (paid to supplier)</div>
                  <Table>
                    <TableHeader><TableRow><TableHead>Supplier</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {supplierList.length === 0 ? (
                        <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground py-4">None</TableCell></TableRow>
                      ) : supplierList.map(([s, v]) => (
                        <TableRow key={s}><TableCell>{s}</TableCell><TableCell className="text-right">{fmt(v)}</TableCell></TableRow>
                      ))}
                      <TableRow><TableCell className="font-semibold">Total</TableCell><TableCell className="text-right font-semibold">{fmt(supplierTotal)}</TableCell></TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
            );
          })()}
          <p className="text-xs text-muted-foreground">Based on the current contact filter and period.</p>
        </DialogContent>
      </Dialog>

      <Dialog open={changePinOpen} onOpenChange={setChangePinOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Change PIN</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Current PIN</Label>
              <Input type="password" inputMode="numeric" value={pinForm.current}
                onChange={(e) => setPinForm({ ...pinForm, current: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>New PIN (4-8 digits)</Label>
              <Input type="password" inputMode="numeric" value={pinForm.next}
                onChange={(e) => setPinForm({ ...pinForm, next: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Confirm New PIN</Label>
              <Input type="password" inputMode="numeric" value={pinForm.confirm}
                onChange={(e) => setPinForm({ ...pinForm, confirm: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangePinOpen(false)}>Cancel</Button>
            <Button onClick={saveNewPin}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TradeRecords;