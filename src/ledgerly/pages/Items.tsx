import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Search, Package } from "lucide-react";
import { toast } from "sonner";
import { formatMoney, formatNumber } from "@/lib/format";
import { useCompany } from "@/contexts/CompanyContext";

interface Item {
  id: string; sku: string | null; name: string; description: string | null; unit: string;
  purchase_rate: number; selling_rate: number; stock_qty: number; avg_cost: number;
}

const Items = () => {
  const { companyId } = useCompany();
  const [rows, setRows] = useState<Item[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [form, setForm] = useState({
    sku: "", name: "", description: "", unit: "kg",
    purchase_rate: "0", selling_rate: "0", stock_qty: "0", avg_cost: "0",
  });

  const load = async () => {
    if (!companyId) return;
    const { data, error } = await supabase.from("items").select("*").eq("company_id", companyId).order("name");
    if (error) toast.error(error.message);
    setRows((data ?? []) as Item[]);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [companyId]);

  const filtered = useMemo(() => rows.filter((r) =>
    !search || r.name.toLowerCase().includes(search.toLowerCase()) || (r.sku ?? "").toLowerCase().includes(search.toLowerCase())
  ), [rows, search]);

  const totals = useMemo(() => {
    const stockValue = rows.reduce((s, r) => s + Number(r.stock_qty) * Number(r.avg_cost || r.purchase_rate), 0);
    return { count: rows.length, stockValue };
  }, [rows]);

  const openNew = () => {
    setEditing(null);
    setForm({ sku: "", name: "", description: "", unit: "kg", purchase_rate: "0", selling_rate: "0", stock_qty: "0", avg_cost: "0" });
    setOpen(true);
  };
  const openEdit = (i: Item) => {
    setEditing(i);
    setForm({
      sku: i.sku ?? "", name: i.name, description: i.description ?? "", unit: i.unit,
      purchase_rate: String(i.purchase_rate), selling_rate: String(i.selling_rate),
      stock_qty: String(i.stock_qty), avg_cost: String(i.avg_cost),
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    if (!companyId) { toast.error("No active company"); return; }
    const purchase = parseFloat(form.purchase_rate || "0") || 0;
    const payload = {
      user_id: u.user.id, company_id: companyId,
      sku: form.sku || null, name: form.name.trim(), description: form.description || null,
      unit: form.unit || "kg",
      purchase_rate: purchase,
      selling_rate: parseFloat(form.selling_rate || "0") || 0,
      stock_qty: parseFloat(form.stock_qty || "0") || 0,
      avg_cost: parseFloat(form.avg_cost || "0") || purchase,
    };
    const { error } = editing
      ? await supabase.from("items").update(payload).eq("id", editing.id)
      : await supabase.from("items").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? "Item updated" : "Item created");
    setOpen(false); load();
  };

  const remove = async (i: Item) => {
    if (!confirm(`Delete "${i.name}"?`)) return;
    const { error } = await supabase.from("items").delete().eq("id", i.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted"); load();
  };

  return (
    <>
      <PageHeader
        title="Items"
        description="Inventory items with weighted-average cost"
        actions={<Button onClick={openNew}><Plus className="h-4 w-4 mr-1.5" />New Item</Button>}
      />
      <div className="p-6 space-y-4">
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
          <Card className="shadow-[var(--shadow-card)]"><CardContent className="p-5 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary-muted text-primary flex items-center justify-center"><Package className="h-5 w-5" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Items</p>
              <p className="text-xl font-semibold num">{totals.count}</p>
            </div>
          </CardContent></Card>
          <Card className="shadow-[var(--shadow-card)]"><CardContent className="p-5 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-success-muted text-success flex items-center justify-center"><Package className="h-5 w-5" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Stock value</p>
              <p className="text-xl font-semibold num">{formatMoney(totals.stockValue)}</p>
            </div>
          </CardContent></Card>
        </div>

        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search items…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>

        <Card className="shadow-[var(--shadow-card)]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">Avg Cost</TableHead>
                <TableHead className="text-right">Purchase</TableHead>
                <TableHead className="text-right">Selling</TableHead>
                <TableHead className="text-right">Stock Value</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((i) => {
                const cost = Number(i.avg_cost) || Number(i.purchase_rate);
                const value = Number(i.stock_qty) * cost;
                return (
                  <TableRow key={i.id}>
                    <TableCell>
                      <div className="font-medium text-foreground">{i.name}</div>
                      {i.description && <div className="text-xs text-muted-foreground">{i.description}</div>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{i.sku ?? "—"}</TableCell>
                    <TableCell className="text-right num">{formatNumber(i.stock_qty, 2)} {i.unit}</TableCell>
                    <TableCell className="text-right num">{formatMoney(cost)}</TableCell>
                    <TableCell className="text-right num">{formatMoney(i.purchase_rate)}</TableCell>
                    <TableCell className="text-right num">{formatMoney(i.selling_rate)}</TableCell>
                    <TableCell className="text-right num font-medium">{formatMoney(value)}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(i)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => remove(i)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-10">No items yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Edit Item" : "New Item"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>SKU</Label>
                <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Name *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Basmati Rice 1121" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Unit</Label>
                <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="kg, bag, ton" />
              </div>
              <div className="space-y-2">
                <Label>Purchase rate</Label>
                <Input type="number" step="0.0001" value={form.purchase_rate} onChange={(e) => setForm({ ...form, purchase_rate: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Selling rate</Label>
                <Input type="number" step="0.0001" value={form.selling_rate} onChange={(e) => setForm({ ...form, selling_rate: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Opening stock</Label>
                <Input type="number" step="0.0001" value={form.stock_qty} onChange={(e) => setForm({ ...form, stock_qty: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Avg cost</Label>
                <Input type="number" step="0.0001" value={form.avg_cost} onChange={(e) => setForm({ ...form, avg_cost: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>{editing ? "Save" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Items;
