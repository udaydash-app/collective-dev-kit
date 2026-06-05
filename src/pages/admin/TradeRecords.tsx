import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, TrendingUp, Users, Printer, Receipt } from "lucide-react";
import { toast } from "sonner";

interface Contact { id: string; name: string; phone?: string; notes?: string }

interface TradeRecord {
  id: string;
  date: string;
  contact_id: string;
  contact_name: string;
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
  expenses: number;
}

const STORAGE_KEY = "admin:trade-records";
const CONTACTS_KEY = "admin:trade-contacts";

const emptyForm = {
  date: new Date().toISOString().slice(0, 10),
  contact_id: "",
  supplier: "",
  description: "",
  packing: "0",
  unit: "kg",
  bags: "1",
  buy_price: "0",
  tax: "0",
  supplier_commission: "0",
  sell_price: "0",
  broker_commission: "0",
  expenses: "0",
};

const totalBuy = (r: { packing: number; buy_price: number; tax: number; supplier_commission: number; bags: number }) =>
  ((r.buy_price || 0) * (r.bags || 0)) + (r.tax || 0) + (r.supplier_commission || 0) + (r.packing || 0);

const profitOf = (r: TradeRecord) =>
  ((r.sell_price || 0) * (r.bags || 0)) - totalBuy(r) - (r.broker_commission || 0) - (r.expenses || 0);

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

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CONTACTS_KEY);
      setContacts(raw ? JSON.parse(raw) : []);
    } catch { setContacts([]); }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      setRecords(raw ? JSON.parse(raw) : []);
    } catch { setRecords([]); }
  }, []);

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
  };

  const removeContact = (id: string) => {
    const used = records.some((r) => r.contact_id === id);
    if (used && !confirm("This contact has trade records. Delete anyway? Records will keep the contact name.")) return;
    if (!used && !confirm("Delete this contact?")) return;
    persistContacts(contacts.filter((c) => c.id !== id));
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
      acc.sell += (r.sell_price || 0) * (r.bags || 0);
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
        acc.turnover += (r.sell_price || 0) * (r.bags || 0);
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
      supplier: r.supplier ?? "",
      description: r.description,
      packing: String(r.packing),
      unit: r.unit ?? "kg",
      bags: String(r.bags ?? 1),
      buy_price: String(r.buy_price),
      tax: String(r.tax),
      supplier_commission: String(r.supplier_commission),
      sell_price: String(r.sell_price),
      broker_commission: String(r.broker_commission),
      expenses: String(r.expenses),
    });
    setOpen(true);
  };

  const save = () => {
    if (!form.contact_id) { toast.error("Select a contact"); return; }
    if (!form.date) { toast.error("Date is required"); return; }
    const contact = contacts.find((c) => c.id === form.contact_id);
    const num = (s: string) => Number(s) || 0;
    const next: TradeRecord = {
      id: editing?.id ?? crypto.randomUUID(),
      date: form.date,
      contact_id: form.contact_id,
      contact_name: contact?.name ?? "",
      supplier: form.supplier.trim(),
      description: form.description.trim(),
      packing: num(form.packing),
      unit: form.unit || "kg",
      bags: num(form.bags),
      buy_price: num(form.buy_price),
      tax: num(form.tax),
      supplier_commission: num(form.supplier_commission),
      sell_price: num(form.sell_price),
      broker_commission: num(form.broker_commission),
      expenses: num(form.expenses),
    };
    persist(editing ? records.map((r) => (r.id === editing.id ? next : r)) : [next, ...records]);
    setOpen(false);
    toast.success(editing ? "Record updated" : "Record added");
  };

  const remove = (id: string) => {
    if (!confirm("Delete this record?")) return;
    persist(records.filter((r) => r.id !== id));
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
          a.sell += (r.sell_price || 0) * (r.bags || 0);
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
              <th>Date</th><th>Description</th>
              <th class="r">Packing</th><th>Unit</th><th class="r">Bags</th>
              <th class="r">Buy Price</th><th class="r">Tax</th><th class="r">Sup. Comm.</th>
              <th class="r">Total Buy</th><th class="r">Sell Price</th>
              <th class="r">Brk. Comm.</th><th class="r">Exps</th><th class="r">Profit</th>
            </tr>
          </thead>
          <tbody>
            ${sorted.map((r) => {
              const tb = totalBuy(r);
              const p = profitOf(r);
              return `<tr>
                <td>${esc(r.date)}</td>
                <td>${esc(r.description)}</td>
                <td class="r">${fmt(r.packing)}</td>
                <td>${esc(r.unit ?? "")}</td>
                <td class="r">${fmt(r.bags ?? 0)}</td>
                <td class="r">${fmt(r.buy_price)}</td>
                <td class="r">${fmt(r.tax)}</td>
                <td class="r">${fmt(r.supplier_commission)}</td>
                <td class="r">${fmt(tb)}</td>
                <td class="r">${fmt(r.sell_price)}</td>
                <td class="r">${fmt(r.broker_commission)}</td>
                <td class="r">${fmt(r.expenses)}</td>
                <td class="r ${p >= 0 ? "pos" : "neg"}">${fmt(p)}</td>
              </tr>`;
            }).join("")}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="8" class="r"><b>Subtotal</b></td>
              <td class="r"><b>${fmt(sub.buy)}</b></td>
              <td class="r"></td>
              <td class="r"></td>
              <td class="r"><b>Turnover ${fmt(sub.sell)}</b></td>
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
      ${filtered.length === 0 ? "<p>No records in selected range.</p>" : groupsHtml}
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
      <header className="border-b border-border bg-card">
        <div className="px-6 py-5 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-md bg-primary/10 text-primary flex items-center justify-center">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Trade Records</h1>
              <p className="text-sm text-muted-foreground">Contact-wise trade ledger with profit tracking</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />Print / PDF
            </Button>
            <Button variant="outline" onClick={() => setContactsOpen(true)}>
              <Users className="h-4 w-4 mr-2" />Contacts
            </Button>
            <Button onClick={openNew} disabled={!contacts.length}>
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
                <TableHead>Supplier</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Packing</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">Bags</TableHead>
                <TableHead className="text-right">Buy Price</TableHead>
                <TableHead className="text-right">Tax</TableHead>
                <TableHead className="text-right">Supplier Comm.</TableHead>
                <TableHead className="text-right">Total Buy</TableHead>
                <TableHead className="text-right">Sell Price</TableHead>
                <TableHead className="text-right">Broker Comm.</TableHead>
                <TableHead className="text-right">Exps</TableHead>
                <TableHead className="text-right">Profit</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={16} className="text-center text-muted-foreground py-10">No records yet</TableCell></TableRow>
              ) : filtered.map((r) => {
                const tb = totalBuy(r);
                const profit = profitOf(r);
                return (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap">{r.date}</TableCell>
                    <TableCell className="whitespace-nowrap">{contactName(r.contact_id)}</TableCell>
                    <TableCell className="whitespace-nowrap">{r.supplier || "—"}</TableCell>
                    <TableCell className="max-w-[240px] truncate">{r.description}</TableCell>
                    <TableCell className="text-right">{fmt(r.packing)}</TableCell>
                    <TableCell>{r.unit ?? "—"}</TableCell>
                    <TableCell className="text-right">{fmt(r.bags ?? 0)}</TableCell>
                    <TableCell className="text-right">{fmt(r.buy_price)}</TableCell>
                    <TableCell className="text-right">{fmt(r.tax)}</TableCell>
                    <TableCell className="text-right">{fmt(r.supplier_commission)}</TableCell>
                    <TableCell className="text-right font-medium">{fmt(tb)}</TableCell>
                    <TableCell className="text-right">{fmt(r.sell_price)}</TableCell>
                    <TableCell className="text-right">{fmt(r.broker_commission)}</TableCell>
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
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing ? "Edit" : "New"} Trade Record</DialogTitle></DialogHeader>
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
            <div className="col-span-2">
              <Label>Supplier</Label>
              <Input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} placeholder="Supplier name" />
            </div>
            <div className="col-span-2">
              <Label>Description</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div>
              <Label>Packing</Label>
              <Input type="number" step="0.01" value={form.packing} onChange={(e) => setForm({ ...form, packing: e.target.value })} />
            </div>
            <div>
              <Label>Unit</Label>
              <Select value={form.unit} onValueChange={(v) => setForm({ ...form, unit: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["kg", "g", "ltr", "ml", "pcs", "dozen", "bag", "box"].map((u) => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Number of Bags</Label>
              <Input type="number" step="1" value={form.bags} onChange={(e) => setForm({ ...form, bags: e.target.value })} />
            </div>
            {([
              ["buy_price", "Buy Price (per bag)"],
              ["tax", "Tax"],
              ["supplier_commission", "Supplier Commission"],
              ["sell_price", "Sell Price (per bag)"],
              ["broker_commission", "Broker Commission"],
              ["expenses", "Expenses"],
            ] as const).map(([key, label]) => (
              <div key={key}>
                <Label>{label}</Label>
                <Input type="number" step="0.01" value={(form as any)[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
              </div>
            ))}
            <div className="col-span-2 rounded-md bg-muted px-3 py-2 text-sm flex justify-between">
              <span>Total Buy: <b>{fmt(totalBuy({ packing: Number(form.packing)||0, buy_price: Number(form.buy_price)||0, tax: Number(form.tax)||0, supplier_commission: Number(form.supplier_commission)||0, bags: Number(form.bags)||0 }))}</b></span>
              <span>Profit: <b>{fmt(
                ((Number(form.sell_price)||0) * (Number(form.bags)||0))
                - (((Number(form.buy_price)||0) * (Number(form.bags)||0)) + (Number(form.tax)||0) + (Number(form.supplier_commission)||0) + (Number(form.packing)||0))
                - (Number(form.broker_commission)||0)
                - (Number(form.expenses)||0)
              )}</b></span>
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
    </div>
  );
};

export default TradeRecords;