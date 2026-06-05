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
import { Plus, Search, ShoppingCart, FileText, Wallet, Pencil, Trash2 } from "lucide-react";
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

interface BillRow {
  id: string;
  bill_number: string;
  bill_date: string;
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

const Bills = () => {
  const navigate = useNavigate();
  const { companyId } = useCompany();
  const [rows, setRows] = useState<BillRow[]>([]);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"all" | "draft" | "open" | "paid">("all");
  const [toDelete, setToDelete] = useState<BillRow | null>(null);
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
      const billId = toDelete.id;
      const { data: jes } = await supabase.from("journal_entries").select("id").eq("source_type", "bill").eq("source_id", billId);
      const jeIds = (jes ?? []).map((j) => j.id);
      if (jeIds.length) {
        await supabase.from("journal_lines").delete().in("entry_id", jeIds);
        await supabase.from("journal_entries").delete().in("id", jeIds);
      }
      await supabase.from("bill_lines").delete().eq("bill_id", billId);
      const { error } = await supabase.from("bills").delete().eq("id", billId);
      if (error) throw error;
      setRows((prev) => prev.filter((r) => r.id !== billId));
      toast.success("Bill deleted");
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
      .from("bills")
      .select("id, bill_number, bill_date, due_date, total, paid_amount, status, contact_id, contact:contacts(name)")
      .eq("company_id", companyId)
      .order("bill_date", { ascending: false });
    if (error) toast.error(error.message);
    setRows((data ?? []) as unknown as BillRow[]);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [companyId]);

  const filtered = useMemo(() => rows.filter((r) => {
    if (tab !== "all" && r.status !== tab) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return r.bill_number.toLowerCase().includes(s) || (r.contact?.name ?? "").toLowerCase().includes(s);
  }), [rows, search, tab]);

  const totals = useMemo(() => {
    const open = rows.filter((r) => r.status === "open" || r.status === "partial");
    const totalOpen = open.reduce((s, r) => s + (Number(r.total) - Number(r.paid_amount)), 0);
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const monthTotal = rows
      .filter((r) => r.status !== "draft" && r.status !== "void" && new Date(r.bill_date) >= monthStart)
      .reduce((s, r) => s + Number(r.total), 0);
    return { totalOpen, monthTotal, count: rows.length };
  }, [rows]);

  return (
    <>
      <PageHeader
        title="Purchase Bills"
        description="Supplier bills with auto-posted journal entries"
        actions={<Button onClick={() => navigate("/bills/new")}><Plus className="h-4 w-4 mr-1.5" />New Bill</Button>}
      />
      <div className="p-6 space-y-4">
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
          <Card className="shadow-[var(--shadow-card)]"><CardContent className="p-5 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary-muted text-primary flex items-center justify-center"><ShoppingCart className="h-5 w-5" /></div>
            <div><p className="text-xs text-muted-foreground">Total bills</p><p className="text-xl font-semibold num">{totals.count}</p></div>
          </CardContent></Card>
          <Card className="shadow-[var(--shadow-card)]"><CardContent className="p-5 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-warning-muted text-warning flex items-center justify-center"><Wallet className="h-5 w-5" /></div>
            <div><p className="text-xs text-muted-foreground">Outstanding payable</p><p className="text-xl font-semibold num">{formatMoney(totals.totalOpen)}</p></div>
          </CardContent></Card>
          <Card className="shadow-[var(--shadow-card)]"><CardContent className="p-5 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-success-muted text-success flex items-center justify-center"><FileText className="h-5 w-5" /></div>
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
            <Input placeholder="Search bill # or supplier…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
        </div>

        <Card className="shadow-[var(--shadow-card)]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bill #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead className="w-28 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id} className="cursor-pointer hover:bg-muted/40" onClick={() => navigate(`/bills/${r.id}`)}>
                  <TableCell className="font-medium">
                    <Link to={`/bills/${r.id}`} onClick={(e) => e.stopPropagation()} className="text-primary hover:underline">{r.bill_number}</Link>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(r.bill_date)}</TableCell>
                  <TableCell>{r.contact?.name ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.due_date ?? "—"}</TableCell>
                  <TableCell><Badge className={`${statusStyle[r.status]} capitalize border-0`}>{r.status}</Badge></TableCell>
                  <TableCell className="text-right num font-medium">{formatMoney(r.total)}</TableCell>
                  <TableCell className="text-right num">{formatMoney(Number(r.total) - Number(r.paid_amount))}</TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" title="Edit" onClick={() => navigate(`/bills/${r.id}`)}>
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
                <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-10">No bills yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete bill {toDelete?.bill_number}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will reverse the journal entry and remove the bill and its line items.
              Bills with payments applied cannot be deleted — remove the payments first.
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

export default Bills;
