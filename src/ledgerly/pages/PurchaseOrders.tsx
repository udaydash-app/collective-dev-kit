import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/ledgerly/integrations/supabase/client";
import { PageHeader } from "@/ledgerly/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, ClipboardList, FileText, Wallet, Pencil, Trash2 } from "lucide-react";
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
import { formatMoney, formatDate } from "@/ledgerly/lib/format";
import { useCompany } from "@/ledgerly/contexts/CompanyContext";

type POStatus = "draft" | "sent" | "partial" | "billed" | "cancelled";

interface PORow {
  id: string;
  po_number: string;
  po_date: string;
  expected_date: string | null;
  total: number;
  status: POStatus;
  contact_id: string;
  contact?: { name: string } | null;
}

const statusStyle: Record<POStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-primary-muted text-primary",
  partial: "bg-warning-muted text-warning",
  billed: "bg-success-muted text-success",
  cancelled: "bg-destructive/10 text-destructive",
};

const PurchaseOrders = () => {
  const navigate = useNavigate();
  const { companyId } = useCompany();
  const [rows, setRows] = useState<PORow[]>([]);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"all" | POStatus>("all");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await (supabase as any).from("purchase_order_lines").delete().eq("po_id", deleteId);
      const { error } = await (supabase as any).from("purchase_orders").delete().eq("id", deleteId);
      if (error) throw error;
      setRows((prev) => prev.filter((r) => r.id !== deleteId));
      toast.success("Purchase order deleted");
      setDeleteId(null);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  const load = async () => {
    if (!companyId) return;
    const { data, error } = await (supabase as any)
      .from("purchase_orders")
      .select("id, po_number, po_date, expected_date, total, status, contact_id")
      .eq("company_id", companyId)
      .order("po_date", { ascending: false });
    if (error) { toast.error(error.message); return; }
    const ids = Array.from(new Set((data ?? []).map((r: any) => r.contact_id).filter(Boolean))) as string[];
    let contactMap: Record<string, { name: string }> = {};
    if (ids.length) {
      const { data: cs } = await supabase.from("contacts").select("id, name").in("id", ids);
      contactMap = Object.fromEntries((cs ?? []).map((c: any) => [c.id, { name: c.name }]));
    }
    setRows(((data ?? []) as any[]).map((r) => ({ ...r, contact: contactMap[r.contact_id] ?? null })) as PORow[]);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [companyId]);

  const filtered = useMemo(() => rows.filter((r) => {
    if (tab !== "all" && r.status !== tab) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return r.po_number.toLowerCase().includes(s) || (r.contact?.name ?? "").toLowerCase().includes(s);
  }), [rows, search, tab]);

  const totals = useMemo(() => {
    const open = rows.filter((r) => r.status === "sent" || r.status === "partial" || r.status === "draft");
    const openValue = open.reduce((s, r) => s + Number(r.total), 0);
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const monthTotal = rows
      .filter((r) => r.status !== "cancelled" && new Date(r.po_date) >= monthStart)
      .reduce((s, r) => s + Number(r.total), 0);
    return { openValue, monthTotal, count: rows.length };
  }, [rows]);

  return (
    <>
      <PageHeader
        title="Purchase Orders"
        description="Track orders to suppliers; convert to bills when received"
        actions={<Button onClick={() => navigate("/ledgerly/purchase-orders/new")}><Plus className="h-4 w-4 mr-1.5" />New PO</Button>}
      />
      <div className="p-6 space-y-4">
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
          <Card className="shadow-[var(--shadow-card)]"><CardContent className="p-5 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary-muted text-primary flex items-center justify-center"><ClipboardList className="h-5 w-5" /></div>
            <div><p className="text-xs text-muted-foreground">Total POs</p><p className="text-xl font-semibold num">{totals.count}</p></div>
          </CardContent></Card>
          <Card className="shadow-[var(--shadow-card)]"><CardContent className="p-5 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-warning-muted text-warning flex items-center justify-center"><Wallet className="h-5 w-5" /></div>
            <div><p className="text-xs text-muted-foreground">Open commitment</p><p className="text-xl font-semibold num">{formatMoney(totals.openValue)}</p></div>
          </CardContent></Card>
          <Card className="shadow-[var(--shadow-card)]"><CardContent className="p-5 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-success-muted text-success flex items-center justify-center"><FileText className="h-5 w-5" /></div>
            <div><p className="text-xs text-muted-foreground">Raised this month</p><p className="text-xl font-semibold num">{formatMoney(totals.monthTotal)}</p></div>
          </CardContent></Card>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="draft">Draft</TabsTrigger>
              <TabsTrigger value="sent">Sent</TabsTrigger>
              <TabsTrigger value="partial">Partial</TabsTrigger>
              <TabsTrigger value="billed">Billed</TabsTrigger>
              <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search PO # or supplier…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
        </div>

        <Card className="shadow-[var(--shadow-card)]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PO #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Expected</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="w-28 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id} className="cursor-pointer hover:bg-muted/40" onClick={() => navigate(`/ledgerly/purchase-orders/${r.id}`)}>
                  <TableCell className="font-medium">
                    <Link to={`/ledgerly/purchase-orders/${r.id}`} onClick={(e) => e.stopPropagation()} className="text-primary hover:underline">{r.po_number}</Link>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(r.po_date)}</TableCell>
                  <TableCell>{r.contact?.name ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.expected_date ? formatDate(r.expected_date) : "—"}</TableCell>
                  <TableCell><Badge className={`${statusStyle[r.status]} capitalize border-0`}>{r.status}</Badge></TableCell>
                  <TableCell className="text-right num font-medium">{formatMoney(r.total)}</TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Edit"
                        onClick={() => navigate(`/ledgerly/purchase-orders/${r.id}`)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Delete"
                        onClick={() => setDeleteId(r.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-10">No purchase orders yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete purchase order?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the PO and its line items. If a bill was already created from it, that bill will remain.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default PurchaseOrders;
