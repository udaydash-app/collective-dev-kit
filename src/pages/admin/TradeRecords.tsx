import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, TrendingUp } from "lucide-react";
import { toast } from "sonner";

interface Contact { id: string; name: string }

interface TradeRecord {
  id: string;
  date: string;
  contact_id: string;
  contact_name: string;
  description: string;
  packing: number;
  buy_price: number;
  tax: number;
  supplier_commission: number;
  sell_price: number;
  broker_commission: number;
  expenses: number;
}

const STORAGE_KEY = "admin:trade-records";

const emptyForm = {
  date: new Date().toISOString().slice(0, 10),
  contact_id: "",
  description: "",
  packing: "0",
  buy_price: "0",
  tax: "0",
  supplier_commission: "0",
  sell_price: "0",
  broker_commission: "0",
  expenses: "0",
};

const totalBuy = (r: { packing: number; buy_price: number; tax: number; supplier_commission: number }) =>
  (r.buy_price || 0) + (r.tax || 0) + (r.supplier_commission || 0) + (r.packing || 0);

const profitOf = (r: TradeRecord) =>
  (r.sell_price || 0) - totalBuy(r) - (r.broker_commission || 0) - (r.expenses || 0);

const fmt = (n: number) => new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

const TradeRecords = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [records, setRecords] = useState<TradeRecord[]>([]);
  const [filterContact, setFilterContact] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TradeRecord | null>(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("contacts").select("id,name").order("name");
      if (error) toast.error(error.message);
      setContacts((data ?? []) as Contact[]);
    })();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      setRecords(raw ? JSON.parse(raw) : []);
    } catch { setRecords([]); }
  }, []);

  const persist = (next: TradeRecord[]) => {
    setRecords(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const filtered = useMemo(() => {
    const list = filterContact === "all" ? records : records.filter((r) => r.contact_id === filterContact);
    return [...list].sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [records, filterContact]);

  const totals = useMemo(() => filtered.reduce(
    (acc, r) => {
      acc.buy += totalBuy(r);
      acc.sell += r.sell_price || 0;
      acc.profit += profitOf(r);
      return acc;
    }, { buy: 0, sell: 0, profit: 0 }
  ), [filtered]);

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
      description: r.description,
      packing: String(r.packing),
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
      description: form.description.trim(),
      packing: num(form.packing),
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
          <Button onClick={openNew} disabled={!contacts.length}>
            <Plus className="h-4 w-4 mr-2" />New Record
          </Button>
        </div>
      </header>

      <div className="p-6 space-y-4">
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
          <div className="ml-auto flex gap-4 text-sm">
            <div><span className="text-muted-foreground">Total Buy: </span><span className="font-medium">{fmt(totals.buy)}</span></div>
            <div><span className="text-muted-foreground">Total Sell: </span><span className="font-medium">{fmt(totals.sell)}</span></div>
            <div><span className="text-muted-foreground">Profit: </span><span className={totals.profit >= 0 ? "font-semibold text-green-600" : "font-semibold text-red-600"}>{fmt(totals.profit)}</span></div>
          </div>
        </div>

        <Card>
          <Table fixedScroll>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Packing</TableHead>
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
                <TableRow><TableCell colSpan={13} className="text-center text-muted-foreground py-10">No records yet</TableCell></TableRow>
              ) : filtered.map((r) => {
                const tb = totalBuy(r);
                const profit = profitOf(r);
                return (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap">{r.date}</TableCell>
                    <TableCell className="whitespace-nowrap">{contactName(r.contact_id)}</TableCell>
                    <TableCell className="max-w-[240px] truncate">{r.description}</TableCell>
                    <TableCell className="text-right">{fmt(r.packing)}</TableCell>
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
          <p className="text-sm text-muted-foreground">Add a contact first from Contacts to start recording trades.</p>
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
              <Label>Description</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            {([
              ["packing", "Packing"],
              ["buy_price", "Buy Price"],
              ["tax", "Tax"],
              ["supplier_commission", "Supplier Commission"],
              ["sell_price", "Sell Price"],
              ["broker_commission", "Broker Commission"],
              ["expenses", "Expenses"],
            ] as const).map(([key, label]) => (
              <div key={key}>
                <Label>{label}</Label>
                <Input type="number" step="0.01" value={(form as any)[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
              </div>
            ))}
            <div className="col-span-2 rounded-md bg-muted px-3 py-2 text-sm flex justify-between">
              <span>Total Buy: <b>{fmt(totalBuy({ packing: Number(form.packing)||0, buy_price: Number(form.buy_price)||0, tax: Number(form.tax)||0, supplier_commission: Number(form.supplier_commission)||0 }))}</b></span>
              <span>Profit: <b>{fmt(
                (Number(form.sell_price)||0)
                - ((Number(form.buy_price)||0) + (Number(form.tax)||0) + (Number(form.supplier_commission)||0) + (Number(form.packing)||0))
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
    </div>
  );
};

export default TradeRecords;