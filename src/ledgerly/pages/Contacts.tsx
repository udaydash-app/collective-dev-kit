import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, Search, Mail, Phone } from "lucide-react";
import { toast } from "sonner";
import { formatMoney } from "@/lib/format";
import { useCompany } from "@/contexts/CompanyContext";

type ContactType = "customer" | "supplier" | "both";
interface Contact {
  id: string; type: ContactType; name: string; email: string | null; phone: string | null;
  address: string | null; opening_balance: number; notes: string | null; is_active: boolean;
}

const Contacts = () => {
  const { companyId } = useCompany();
  const [rows, setRows] = useState<Contact[]>([]);
  const [tab, setTab] = useState<"all" | ContactType>("all");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [form, setForm] = useState({ type: "customer" as ContactType, name: "", email: "", phone: "", address: "", opening_balance: "0", notes: "" });

  const load = async () => {
    if (!companyId) return;
    const { data, error } = await supabase.from("contacts").select("*").eq("company_id", companyId).order("name");
    if (error) toast.error(error.message);
    setRows((data ?? []) as Contact[]);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [companyId]);

  const filtered = useMemo(() => rows.filter((r) =>
    (tab === "all" || r.type === tab || r.type === "both") &&
    (!search || r.name.toLowerCase().includes(search.toLowerCase()) || (r.email ?? "").toLowerCase().includes(search.toLowerCase()) || (r.phone ?? "").includes(search))
  ), [rows, tab, search]);

  const openNew = () => {
    setEditing(null);
    setForm({ type: tab === "all" ? "customer" : tab, name: "", email: "", phone: "", address: "", opening_balance: "0", notes: "" });
    setOpen(true);
  };
  const openEdit = (c: Contact) => {
    setEditing(c);
    setForm({
      type: c.type, name: c.name, email: c.email ?? "", phone: c.phone ?? "",
      address: c.address ?? "", opening_balance: String(c.opening_balance ?? 0), notes: c.notes ?? "",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    if (!companyId) { toast.error("No active company"); return; }
    const payload = {
      user_id: u.user.id, company_id: companyId, type: form.type, name: form.name.trim(),
      email: form.email || null, phone: form.phone || null, address: form.address || null,
      opening_balance: parseFloat(form.opening_balance || "0") || 0, notes: form.notes || null,
    };
    const { error } = editing
      ? await supabase.from("contacts").update(payload).eq("id", editing.id)
      : await supabase.from("contacts").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? "Contact updated" : "Contact created");
    setOpen(false); load();
  };

  const remove = async (c: Contact) => {
    if (!confirm(`Delete "${c.name}"?`)) return;
    const { error } = await supabase.from("contacts").delete().eq("id", c.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted"); load();
  };

  return (
    <>
      <PageHeader
        title="Contacts"
        description="Customers and suppliers"
        actions={<Button onClick={openNew}><Plus className="h-4 w-4 mr-1.5" />New Contact</Button>}
      />
      <div className="p-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="customer">Customers</TabsTrigger>
              <TabsTrigger value="supplier">Suppliers</TabsTrigger>
              <TabsTrigger value="both">Both</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
        </div>

        <Card className="shadow-[var(--shadow-card)]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead className="text-right">Opening Balance</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={
                      c.type === "customer" ? "bg-success-muted text-success" :
                      c.type === "supplier" ? "bg-warning-muted text-warning" :
                      "bg-primary-muted text-primary"
                    }>{c.type}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    <div className="flex flex-col gap-0.5">
                      {c.email && <span className="flex items-center gap-1.5"><Mail className="h-3 w-3" />{c.email}</span>}
                      {c.phone && <span className="flex items-center gap-1.5"><Phone className="h-3 w-3" />{c.phone}</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-right num">{formatMoney(c.opening_balance)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => remove(c)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-10">No contacts yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Edit Contact" : "New Contact"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Type *</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as ContactType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="customer">Customer</SelectItem>
                    <SelectItem value="supplier">Supplier</SelectItem>
                    <SelectItem value="both">Both</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Opening balance</Label>
                <Input type="number" step="0.01" value={form.opening_balance} onChange={(e) => setForm({ ...form, opening_balance: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Textarea rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
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

export default Contacts;
