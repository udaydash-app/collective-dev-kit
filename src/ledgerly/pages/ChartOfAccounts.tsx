import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { useCompany } from "@/contexts/CompanyContext";

type AccountType = "asset" | "liability" | "equity" | "income" | "expense";
interface Account {
  id: string; code: string | null; name: string; type: AccountType;
  parent_id: string | null; description: string | null; is_active: boolean; is_system: boolean;
}

const TYPE_BADGE: Record<AccountType, string> = {
  asset: "bg-primary-muted text-primary",
  liability: "bg-warning-muted text-warning",
  equity: "bg-accent text-accent-foreground",
  income: "bg-success-muted text-success",
  expense: "bg-destructive/10 text-destructive",
};

const ChartOfAccounts = () => {
  const { companyId } = useCompany();
  const [rows, setRows] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [form, setForm] = useState({ code: "", name: "", type: "asset" as AccountType, parent_id: "none", description: "" });

  const load = async () => {
    if (!companyId) return;
    setLoading(true);
    const { data, error } = await supabase.from("accounts").select("*").eq("company_id", companyId).order("code", { ascending: true });
    if (error) toast.error(error.message);
    setRows((data ?? []) as Account[]);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [companyId]);

  const filtered = useMemo(() => rows.filter((r) =>
    (typeFilter === "all" || r.type === typeFilter) &&
    (!search || r.name.toLowerCase().includes(search.toLowerCase()) || (r.code ?? "").includes(search))
  ), [rows, search, typeFilter]);

  const grouped = useMemo(() => {
    const g: Record<AccountType, Account[]> = { asset: [], liability: [], equity: [], income: [], expense: [] };
    filtered.forEach((r) => g[r.type].push(r));
    return g;
  }, [filtered]);

  const openNew = () => {
    setEditing(null);
    setForm({ code: "", name: "", type: "asset", parent_id: "none", description: "" });
    setOpen(true);
  };
  const openEdit = (a: Account) => {
    setEditing(a);
    setForm({ code: a.code ?? "", name: a.name, type: a.type, parent_id: a.parent_id ?? "none", description: a.description ?? "" });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    if (!companyId) { toast.error("No active company"); return; }
    const payload = {
      code: form.code || null, name: form.name.trim(), type: form.type,
      parent_id: form.parent_id === "none" ? null : form.parent_id,
      description: form.description || null, user_id: u.user.id, company_id: companyId,
    };
    const { error } = editing
      ? await supabase.from("accounts").update(payload).eq("id", editing.id)
      : await supabase.from("accounts").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? "Account updated" : "Account created");
    setOpen(false); load();
  };

  const remove = async (a: Account) => {
    if (a.is_system) { toast.error("System accounts cannot be deleted"); return; }
    if (!confirm(`Delete account "${a.name}"?`)) return;
    const { error } = await supabase.from("accounts").delete().eq("id", a.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted"); load();
  };

  const parentOptions = rows.filter((r) => r.type === form.type && r.id !== editing?.id);

  return (
    <>
      <PageHeader
        title="Chart of Accounts"
        description="Organize all the accounts used in your books"
        actions={<Button onClick={openNew}><Plus className="h-4 w-4 mr-1.5" />New Account</Button>}
      />
      <div className="p-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by name or code…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="asset">Assets</SelectItem>
              <SelectItem value="liability">Liabilities</SelectItem>
              <SelectItem value="equity">Equity</SelectItem>
              <SelectItem value="income">Income</SelectItem>
              <SelectItem value="expense">Expenses</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card className="shadow-[var(--shadow-card)] overflow-hidden">
          <div className="divide-y divide-border">
            {(["asset","liability","equity","income","expense"] as AccountType[]).map((t) => (
              grouped[t].length > 0 && (
                <div key={t}>
                  <div className="px-5 py-2.5 bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground font-medium">
                    {({ asset: "Assets", liability: "Liabilities", equity: "Equity", income: "Income", expense: "Expenses" } as const)[t]}
                  </div>
                  {grouped[t].map((a) => (
                    <div key={a.id} className="px-5 py-3 flex items-center gap-4 hover:bg-muted/30">
                      <div className="w-20 text-sm text-muted-foreground num">{a.code}</div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-foreground">
                          {a.name}
                          {a.is_system && <Badge variant="secondary" className="ml-2 text-[10px]">system</Badge>}
                        </div>
                        {a.description && <div className="text-xs text-muted-foreground mt-0.5">{a.description}</div>}
                      </div>
                      <Badge className={TYPE_BADGE[a.type]} variant="secondary">{a.type}</Badge>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(a)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => remove(a)} disabled={a.is_system}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ))}
            {!loading && filtered.length === 0 && (
              <div className="p-10 text-center text-sm text-muted-foreground">No accounts found.</div>
            )}
          </div>
        </Card>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Account" : "New Account"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Code</Label>
                <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="e.g. 1100" />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Name *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Type *</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as AccountType, parent_id: "none" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asset">Asset</SelectItem>
                    <SelectItem value="liability">Liability</SelectItem>
                    <SelectItem value="equity">Equity</SelectItem>
                    <SelectItem value="income">Income</SelectItem>
                    <SelectItem value="expense">Expense</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Parent account</Label>
                <Select value={form.parent_id} onValueChange={(v) => setForm({ ...form, parent_id: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— None —</SelectItem>
                    {parentOptions.map((p) => <SelectItem key={p.id} value={p.id}>{p.code ? `${p.code} · ` : ""}{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
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

export default ChartOfAccounts;
