import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MinimizableDialog } from "@/components/ui/minimizable-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowDownCircle, ArrowUpCircle, Plus, Pencil, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/utils";

interface Entry {
  id: string;
  entry_date: string;
  type: "in" | "out";
  amount: number;
  description: string | null;
  counterparty: string | null;
  payment_method: string | null;
}

const todayISO = () => new Date().toISOString().slice(0, 10);
const fmtDate = (s: string) => {
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
};

const emptyForm = {
  entry_date: todayISO(),
  type: "in" as "in" | "out",
  amount: "",
  description: "",
  counterparty: "",
  payment_method: "Cash",
};

export default function CashRegister() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [filterMethod, setFilterMethod] = useState<string>("all");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("cash_register_entries")
      .select("*")
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setEntries((data || []) as Entry[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openNew = (type: "in" | "out") => {
    setEditingId(null);
    setForm({ ...emptyForm, type });
    setDialogOpen(true);
  };

  const openEdit = (e: Entry) => {
    setEditingId(e.id);
    setForm({
      entry_date: e.entry_date,
      type: e.type,
      amount: String(e.amount),
      description: e.description || "",
      counterparty: e.counterparty || "",
      payment_method: e.payment_method || "Cash",
    });
    setDialogOpen(true);
  };

  const save = async () => {
    const amt = parseFloat(form.amount);
    if (isNaN(amt) || amt <= 0) { toast.error("Enter a valid amount"); return; }
    const payload = {
      entry_date: form.entry_date,
      type: form.type,
      amount: amt,
      description: form.description || null,
      counterparty: form.counterparty || null,
      payment_method: form.payment_method || null,
    };
    if (editingId) {
      const { error } = await supabase.from("cash_register_entries").update(payload).eq("id", editingId);
      if (error) return toast.error(error.message);
      toast.success("Entry updated");
    } else {
      const { error } = await supabase.from("cash_register_entries").insert(payload);
      if (error) return toast.error(error.message);
      toast.success("Entry added");
    }
    setDialogOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this entry?")) return;
    const { error } = await supabase.from("cash_register_entries").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Entry deleted");
    load();
  };

  const filtered = useMemo(() => {
    if (filterMethod === "all") return entries;
    return entries.filter((e) => (e.payment_method || "Cash") === filterMethod);
  }, [entries, filterMethod]);

  const methods = useMemo(() => {
    const s = new Set<string>();
    entries.forEach((e) => s.add(e.payment_method || "Cash"));
    return Array.from(s);
  }, [entries]);

  const totalIn = filtered.filter((e) => e.type === "in").reduce((s, e) => s + Number(e.amount || 0), 0);
  const totalOut = filtered.filter((e) => e.type === "out").reduce((s, e) => s + Number(e.amount || 0), 0);
  const balance = totalIn - totalOut;

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6 max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Wallet className="h-7 w-7 text-primary" /> Cash Register
          </h1>
          <p className="text-sm text-muted-foreground">Track payments received and paid to know your cash in hand.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => openNew("in")} className="bg-emerald-600 hover:bg-emerald-700">
            <ArrowDownCircle className="h-4 w-4 mr-1" /> Cash In
          </Button>
          <Button onClick={() => openNew("out")} variant="destructive">
            <ArrowUpCircle className="h-4 w-4 mr-1" /> Cash Out
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 border-l-4 border-emerald-500">
          <p className="text-xs uppercase text-muted-foreground">Total Received</p>
          <p className="text-2xl font-bold text-emerald-600">{formatCurrency(totalIn)}</p>
        </Card>
        <Card className="p-4 border-l-4 border-rose-500">
          <p className="text-xs uppercase text-muted-foreground">Total Paid</p>
          <p className="text-2xl font-bold text-rose-600">{formatCurrency(totalOut)}</p>
        </Card>
        <Card className="p-4 border-l-4 border-primary">
          <p className="text-xs uppercase text-muted-foreground">Cash in Hand</p>
          <p className={`text-2xl font-bold ${balance >= 0 ? "text-primary" : "text-rose-600"}`}>{formatCurrency(balance)}</p>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <h2 className="font-semibold">Entries</h2>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Method</Label>
            <Select value={filterMethod} onValueChange={setFilterMethod}>
              <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All methods</SelectItem>
                {methods.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Counterparty</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Method</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Loading...</TableCell></TableRow>
              )}
              {!loading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No entries yet</TableCell></TableRow>
              )}
              {filtered.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>{fmtDate(e.entry_date)}</TableCell>
                  <TableCell>
                    {e.type === "in" ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600 font-medium"><ArrowDownCircle className="h-4 w-4" />In</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-rose-600 font-medium"><ArrowUpCircle className="h-4 w-4" />Out</span>
                    )}
                  </TableCell>
                  <TableCell>{e.counterparty || "-"}</TableCell>
                  <TableCell className="max-w-[260px] truncate">{e.description || "-"}</TableCell>
                  <TableCell>{e.payment_method || "Cash"}</TableCell>
                  <TableCell className={`text-right font-semibold ${e.type === "in" ? "text-emerald-600" : "text-rose-600"}`}>
                    {e.type === "in" ? "+" : "-"}{formatCurrency(Number(e.amount || 0))}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(e)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(e.id)}><Trash2 className="h-4 w-4 text-rose-600" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <MinimizableDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editingId ? "Edit Entry" : form.type === "in" ? "Cash In (Received)" : "Cash Out (Paid)"}
        icon={Wallet}
        className="max-w-md"
      >
          <div className="space-y-3">
            <div>
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v: "in" | "out") => setForm((f) => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="in">Cash In (Received)</SelectItem>
                  <SelectItem value="out">Cash Out (Paid)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Date</Label>
              <Input type="date" value={form.entry_date} onChange={(e) => setForm((f) => ({ ...f, entry_date: e.target.value }))} />
            </div>
            <div>
              <Label>Amount</Label>
              <Input type="number" step="0.01" min="0" autoFocus value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} placeholder="0.00" />
            </div>
            <div>
              <Label>Counterparty</Label>
              <Input value={form.counterparty} onChange={(e) => setForm((f) => ({ ...f, counterparty: e.target.value }))} placeholder="Customer / Supplier name" />
            </div>
            <div>
              <Label>Description</Label>
              <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="What is this for?" />
            </div>
            <div>
              <Label>Payment Method</Label>
              <Select value={form.payment_method} onValueChange={(v) => setForm((f) => ({ ...f, payment_method: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="Mobile Money">Mobile Money</SelectItem>
                  <SelectItem value="Bank">Bank</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save}>{editingId ? "Update" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}