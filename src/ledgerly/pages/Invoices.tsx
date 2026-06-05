import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, FileText, Wallet, TrendingUp, Pencil, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { formatMoney, formatDate } from "@/lib/format";
import { useCompany } from "@/contexts/CompanyContext";

interface InvoiceRow {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  total: number;
  paid_amount: number;
  status: "draft" | "open" | "partial" | "paid" | "void";
  contact_id: string;
  contact?: { name: string } | null;
}

const statusStyle: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  open: "bg-primary-muted text-primary",
  partial: "bg-warning-muted text-warning",
  paid: "bg-success-muted text-success",
  void: "bg-destructive/10 text-destructive",
};

const Invoices = () => {
  const navigate = useNavigate();
  const { companyId } = useCompany();
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"all" | "draft" | "open" | "paid">("all");
  const [toDelete, setToDelete] = useState<InvoiceRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!toDelete) return;
    if (Number(toDelete.paid_amount) > 0) {
      toast.error("Delete the linked payments first");
      setToDelete(null);
      return;
    }
    setDeleting(true);
    try {
      const invId = toDelete.id;
      const { data: jes } = await supabase.from("journal_entries").select("id").eq("source_type", "invoice").eq("source_id", invId);
      const jeIds = (jes ?? []).map((j) => j.id);
      if (jeIds.length) {
        await supabase.from("journal_lines").delete().in("entry_id", jeIds);
        await supabase.from("journal_entries").delete().in("id", jeIds);
      }
      await supabase.from("invoice_lines").delete().eq("invoice_id", invId);
      const { error } = await supabase.from("invoices").delete().eq("id", invId);
      if (error) throw error;
      setRows((prev) => prev.filter((r) => r.id !== invId));
      toast.success("Invoice deleted");
      setToDelete(null);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  const load = async () => {
    if (!companyId) return;
    const { data, error } = await supabase
      .from("invoices")
      .select("id, invoice_number, invoice_date, due_date, total, paid_amount, status, contact_id, contact:contacts(name)")
      .eq("company_id", companyId)
      .order("invoice_date", { ascending: false });
    if (error) toast.error(error.message);
    setRows((data ?? []) as unknown as InvoiceRow[]);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [companyId]);

  const filtered = useMemo(() => rows.filter((r) => {
    if (tab !== "all" && r.status !== tab) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return r.invoice_number.toLowerCase().includes(s) || (r.contact?.name ?? "").toLowerCase().includes(s);
  }), [rows, search, tab]);

  const totals = useMemo(() => {
    const open = rows.filter((r) => r.status === "open" || r.status === "partial");
    const totalOpen = open.reduce((s, r) => s + (Number(r.total) - Number(r.paid_amount)), 0);
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const monthTotal = rows
      .filter((r) => r.status !== "draft" && r.status !== "void" && new Date(r.invoice_date) >= monthStart)
      .reduce((s, r) => s + Number(r.total), 0);
    return { totalOpen, monthTotal, count: rows.length };
  }, [rows]);

  return (
    <>
      <PageHeader
        title="Sales Invoices"
        description="Customer invoices with auto-posted journal & COGS"
        actions={<Button onClick={() => navigate("/invoices/new")}><Plus className="h-4 w-4 mr-1.5" />New Invoice</Button>}
      />
      <div className="p-6 space-y-4">
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
          <Card className="shadow-[var(--shadow-card)]"><CardContent className="p-5 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary-muted text-primary flex items-center justify-center"><FileText className="h-5 w-5" /></div>
            <div><p className="text-xs text-muted-foreground">Total invoices</p><p className="text-xl font-semibold num">{totals.count}</p></div>
          </CardContent></Card>
          <Card className="shadow-[var(--shadow-card)]"><CardContent className="p-5 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-warning-muted text-warning flex items-center justify-center"><Wallet className="h-5 w-5" /></div>
            <div><p className="text-xs text-muted-foreground">Outstanding receivable</p><p className="text-xl font-semibold num">{formatMoney(totals.totalOpen)}</p></div>
          </CardContent></Card>
          <Card className="shadow-[var(--shadow-card)]"><CardContent className="p-5 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-success-muted text-success flex items-center justify-center"><TrendingUp className="h-5 w-5" /></div>
            <div><p className="text-xs text-muted-foreground">Posted this month</p><p className="text-xl font-semibold num">{formatMoney(totals.monthTotal)}</p></div>
          </CardContent></Card>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="draft">Draft</TabsTrigger>
              <TabsTrigger value="open">Open</TabsTrigger>
              <TabsTrigger value="paid">Paid</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search invoice # or customer…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
        </div>

        <Card className="shadow-[var(--shadow-card)]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead className="w-28 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id} className="cursor-pointer hover:bg-muted/40" onClick={() => navigate(`/invoices/${r.id}`)}>
                  <TableCell className="font-medium">
                    <Link to={`/invoices/${r.id}`} onClick={(e) => e.stopPropagation()} className="text-primary hover:underline">{r.invoice_number}</Link>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(r.invoice_date)}</TableCell>
                  <TableCell>{r.contact?.name ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.due_date ?? "—"}</TableCell>
                  <TableCell><Badge className={`${statusStyle[r.status]} capitalize border-0`}>{r.status}</Badge></TableCell>
                  <TableCell className="text-right num font-medium">{formatMoney(r.total)}</TableCell>
                  <TableCell className="text-right num">{formatMoney(Number(r.total) - Number(r.paid_amount))}</TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" title="Edit" onClick={() => navigate(`/invoices/${r.id}`)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Delete" onClick={() => setToDelete(r)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-10">No invoices yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete invoice {toDelete?.invoice_number}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will reverse the journal entry and remove the invoice and its line items.
              Invoices with payments applied cannot be deleted — remove the payments first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); handleDelete(); }} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default Invoices;
