import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, Wallet, ArrowDownLeft, ArrowUpRight, MoreHorizontal, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { formatMoney, formatDate } from "@/lib/format";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { reversePayment } from "@/lib/posting";
import { useCompany } from "@/contexts/CompanyContext";

interface PaymentRow {
  id: string;
  payment_date: string;
  amount: number;
  direction: "in" | "out";
  mode: "cash" | "bank" | "other";
  reference: string | null;
  invoice_id: string | null;
  bill_id: string | null;
  contact: { name: string } | null;
  account: { name: string } | null;
  invoice: { invoice_number: string } | null;
  bill: { bill_number: string } | null;
}

const Payments = () => {
  const navigate = useNavigate();
  const { companyId } = useCompany();
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"all" | "in" | "out">("all");
  const [toDelete, setToDelete] = useState<PaymentRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    if (!companyId) return;
    const { data, error } = await supabase
      .from("payments")
      .select(`
        id, payment_date, amount, direction, mode, reference, invoice_id, bill_id,
        contact:contacts(name), account:accounts(name),
        invoice:invoices(invoice_number), bill:bills(bill_number)
      `)
      .eq("company_id", companyId)
      .order("payment_date", { ascending: false });
    if (error) toast.error(error.message);
    setRows((data ?? []) as unknown as PaymentRow[]);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [companyId]);

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      const p = toDelete;
      await reversePayment(p.id);
      const { error: delErr } = await supabase.from("payments").delete().eq("id", p.id);
      if (delErr) throw delErr;
      toast.success("Payment deleted and reversed");
      setToDelete(null);
      await load();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to delete payment";
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  };

  const filtered = useMemo(() => rows.filter((r) => {
    if (tab !== "all" && r.direction !== tab) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    const docNum = r.invoice?.invoice_number ?? r.bill?.bill_number ?? "";
    return (r.contact?.name ?? "").toLowerCase().includes(s)
      || docNum.toLowerCase().includes(s)
      || (r.reference ?? "").toLowerCase().includes(s);
  }), [rows, search, tab]);

  const totals = useMemo(() => {
    const inflow = rows.filter((r) => r.direction === "in").reduce((s, r) => s + Number(r.amount), 0);
    const outflow = rows.filter((r) => r.direction === "out").reduce((s, r) => s + Number(r.amount), 0);
    return { inflow, outflow, net: inflow - outflow };
  }, [rows]);

  return (
    <>
      <PageHeader
        title="Payments & Receipts"
        description="Money in (receipts) and money out (payments)"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/payments/new?type=in")}>
              <ArrowDownLeft className="h-4 w-4 mr-1.5" />Receipt
            </Button>
            <Button onClick={() => navigate("/payments/new?type=out")}>
              <ArrowUpRight className="h-4 w-4 mr-1.5" />Payment
            </Button>
          </div>
        }
      />
      <div className="p-6 space-y-4">
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
          <Card className="shadow-[var(--shadow-card)]"><CardContent className="p-5 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-success-muted text-success flex items-center justify-center"><ArrowDownLeft className="h-5 w-5" /></div>
            <div><p className="text-xs text-muted-foreground">Total received</p><p className="text-xl font-semibold num">{formatMoney(totals.inflow)}</p></div>
          </CardContent></Card>
          <Card className="shadow-[var(--shadow-card)]"><CardContent className="p-5 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-warning-muted text-warning flex items-center justify-center"><ArrowUpRight className="h-5 w-5" /></div>
            <div><p className="text-xs text-muted-foreground">Total paid</p><p className="text-xl font-semibold num">{formatMoney(totals.outflow)}</p></div>
          </CardContent></Card>
          <Card className="shadow-[var(--shadow-card)]"><CardContent className="p-5 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary-muted text-primary flex items-center justify-center"><Wallet className="h-5 w-5" /></div>
            <div><p className="text-xs text-muted-foreground">Net cash flow</p><p className="text-xl font-semibold num">{formatMoney(totals.net)}</p></div>
          </CardContent></Card>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="in">Receipts</TabsTrigger>
              <TabsTrigger value="out">Payments</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search contact, doc # or reference…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
        </div>

        <Card className="shadow-[var(--shadow-card)]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Document</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(r.payment_date)}</TableCell>
                  <TableCell>
                    <Badge className={`${r.direction === "in" ? "bg-success-muted text-success" : "bg-warning-muted text-warning"} border-0 capitalize`}>
                      {r.direction === "in" ? "Receipt" : "Payment"}
                    </Badge>
                  </TableCell>
                  <TableCell>{r.contact?.name ?? "—"}</TableCell>
                  <TableCell className="text-sm">{r.invoice?.invoice_number ?? r.bill?.bill_number ?? <span className="text-muted-foreground italic">On account</span>}</TableCell>
                  <TableCell className="text-sm text-muted-foreground capitalize">{r.account?.name ?? r.mode}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.reference ?? "—"}</TableCell>
                  <TableCell className={`text-right num font-medium ${r.direction === "in" ? "text-success" : "text-warning"}`}>
                    {r.direction === "in" ? "+" : "−"}{formatMoney(r.amount)}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/payments/${r.id}/edit`)}>
                          <Pencil className="h-4 w-4 mr-2" />Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setToDelete(r)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-10">No payments yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this {toDelete?.direction === "in" ? "receipt" : "payment"}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will reverse the journal entry and update the linked{" "}
              {toDelete?.direction === "in" ? "invoice" : "bill"} balance. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default Payments;
