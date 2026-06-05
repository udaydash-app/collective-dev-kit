import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/ledgerly/integrations/supabase/client";
import { PageHeader } from "@/ledgerly/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatMoney } from "@/ledgerly/lib/format";
import { useCompany } from "@/ledgerly/contexts/CompanyContext";

interface Contact { id: string; name: string; }

interface TradeRecord {
  id: string;
  date: string;
  contact_id: string;
  description: string;
  packing: number;
  buy_price: number;
  tax: number;
  supplier_commission: number;
  sell_price: number;
  broker_commission: number;
  expenses: number;
}

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

const storageKey = (companyId: string) => `ledgerly:trade-records:${companyId}`;

const computeTotalBuy = (r: { packing: number; buy_price: number; tax: number; supplier_commission: number }) =>
  (r.buy_price || 0) + (r.tax || 0) + (r.supplier_commission || 0) + (r.packing || 0);

const computeProfit = (r: TradeRecord) =>
  (r.sell_price || 0) - computeTotalBuy(r) - (r.broker_commission || 0) - (r.expenses || 0);

const TradeRecords = () => {
  const { companyId } = useCompany();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [records, setRecords] = useState<TradeRecord[]>([]);
  const [filterContact, setFilterContact] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TradeRecord | null>(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (!companyId) return;
    (async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("id,name")
        .eq("company_id", companyId)
        .order("name");
      if (error) toast.error(error.message);
      setContacts((data ?? []) as Contact[]);
    })();
    try {
      const raw = localStorage.getItem(storageKey(companyId));
      setRecords(raw ? JSON.parse(raw) : []);
    } catch {
      setRecords([]);
    }
  }, [companyId]);

  const persist = (next: TradeRecord[]) => {
    if (!companyId) return;
    setRecords(next);
    localStorage.setItem(storageKey(companyId), JSON.stringify(next));
  };

  const filtered = useMemo(() => {
    const list = filterContact === "all" ? records : records.filter((r) => r.contact_id === filterContact);
    return [...list].sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [records, filterContact]);

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, r) => {
        acc.buy += computeTotalBuy(r);
        acc.sell += r.sell_price || 0;
        acc.profit += computeProfit(r);
        return acc;
      },
      { buy: 0, sell: 0, profit: 0 },
    );
  }, [filtered]);

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
    const num = (s: string) => Number(s) || 0;
    const next: TradeRecord = {
      id: editing?.id ?? crypto.randomUUID(),
      date: form.date,
      contact_id: form.contact_id,
      description: form.description.trim(),
      packing: num(form.packing),
      buy_price: num(form.buy_price),
      tax: num(form.tax),
      supplier_commission: num(form.supplier_commission),
      sell_price: num(form.sell_price),
      broker_commission: num(form.broker_commission),
      expenses: num(form.expenses),
    };
    const list = editing
      ? records.map((r) => (r.id === editing.id ? next : r))
      : [next, ...records];
    persist(list);
    setOpen(false);
    toast.success(editing ? "Record updated" : "Record added");
  };

  const remove = (id: string) => {
    if (!confirm("Delete this record?")) return;
    persist(records.filter((r) => r.id !== id));
  };

  const contactName = (id: string) => contacts.find((c) => c.id === id)?.name ?? "—";

  return (
    <div className="flex-1 flex flex-col">
      <PageHeader
        title="Trade Records"
        description="Contact-wise trade ledger: packing, buy, tax, commissions, expenses & profit"
        actions={
          <Button onClick={openNew} disabled={!contacts.length}>
            <Plus className="h-4 w-4 mr-2" />New Record
          </Button>
        }
      />
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
            <div><span className="text-muted-foreground">Total Buy: </span><span className="font-medium">{formatMoney(totals.buy)}</span></div>
            <div><span className="text-muted-foreground">Total Sell: </span><span className="font-medium">{formatMoney(totals.sell)}</span></div>
            <div><span className="text-muted-foreground">Profit: </span><span className={totals.profit >= 0 ? "font-semibold text-green-600" : "font-semibold text-red-600"}>{formatMoney(totals.profit)}</span></div>
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
                const tb = computeTotalBuy(r);
                const profit = computeProfit(r);
                return (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap">{r.date}</TableCell>
                    <TableCell className="whitespace-nowrap">{contactName(r.contact_id)}</TableCell>
                    <TableCell className="max-w-[240px] truncate">{r.description}</TableCell>
                    <TableCell className="text-right">{formatMoney(r.packing)}</TableCell>
                    <TableCell className="text-right">{formatMoney(r.buy_price)}</TableCell>
                    <TableCell className="text-right">{formatMoney(r.tax)}</TableCell>
                    <TableCell className="text-right">{formatMoney(r.supplier_commission)}</TableCell>
                    <TableCell className="text-right font-medium">{formatMoney(tb)}</TableCell>
                    <TableCell className="text-right">{formatMoney(r.sell_price)}</TableCell>
                    <TableCell className="text-right">{formatMoney(r.broker_commission)}</TableCell>
                    <TableCell className="text-right">{formatMoney(r.expenses)}</TableCell>
                    <TableCell className={"text-right font-semibold " + (profit >= 0 ? "text-green-600" : "text-red-600")}>{formatMoney(profit)}</TableCell>
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
          <p className="text-sm text-muted-foreground">Add a contact first from the Contacts page to start recording trades.</p>
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
              <span>Total Buy: <b>{formatMoney(computeTotalBuy({ packing: Number(form.packing)||0, buy_price: Number(form.buy_price)||0, tax: Number(form.tax)||0, supplier_commission: Number(form.supplier_commission)||0 }))}</b></span>
              <span>Profit: <b>{formatMoney(
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