import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/ledgerly/integrations/supabase/client";
import { PageHeader } from "@/ledgerly/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Receipt, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatMoney, formatDate } from "@/ledgerly/lib/format";
import { useCompany } from "@/ledgerly/contexts/CompanyContext";

interface ExpenseRow {
  id: string;
  expense_date: string;
  amount: number;
  mode: "cash" | "bank" | "other";
  reference: string | null;
  notes: string | null;
  category: { name: string; code: string | null } | null;
  paid_from: { name: string; code: string | null } | null;
  contact: { name: string } | null;
}

const Expenses = () => {
  const { companyId } = useCompany();
  const [rows, setRows] = useState<ExpenseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const load = async () => {
    if (!companyId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("expenses")
      .select(`
        id, expense_date, amount, mode, reference, notes,
        category:accounts!expenses_category_account_id_fkey(name, code),
        paid_from:accounts!expenses_paid_from_account_id_fkey(name, code),
        contact:contacts(name)
      `)
      .eq("company_id", companyId)
      .order("expense_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) { toast.error(error.message); setLoading(false); return; }
    setRows((data ?? []) as unknown as ExpenseRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [companyId]);

  const filtered = useMemo(() => rows.filter((r) =>
    !q ||
    r.reference?.toLowerCase().includes(q.toLowerCase()) ||
    r.notes?.toLowerCase().includes(q.toLowerCase()) ||
    r.category?.name.toLowerCase().includes(q.toLowerCase()) ||
    r.contact?.name.toLowerCase().includes(q.toLowerCase())
  ), [rows, q]);

  const totals = useMemo(() => {
    const today = new Date(); today.setDate(1);
    const monthStart = today.toISOString().slice(0, 10);
    const total = rows.reduce((s, r) => s + Number(r.amount), 0);
    const month = rows.filter((r) => r.expense_date >= monthStart).reduce((s, r) => s + Number(r.amount), 0);
    return { total, month, count: rows.length };
  }, [rows]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this expense and its journal entry?")) return;
    // Delete linked journal entry first (lines cascade isn't guaranteed; delete lines then entry)
    const { data: jes } = await supabase.from("journal_entries").select("id").eq("source_type", "expense").eq("source_id", id);
    const ids = (jes ?? []).map((j) => j.id);
    if (ids.length) {
      await supabase.from("journal_lines").delete().in("entry_id", ids);
      await supabase.from("journal_entries").delete().in("id", ids);
    }
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Expense deleted");
    load();
  };

  return (
    <>
      <PageHeader
        title="Expenses"
        description="Operating expenses paid from cash or bank"
        actions={
          <Button asChild size="sm">
            <Link to="/ledgerly/expenses/new"><Plus className="h-4 w-4 mr-2" />Record Expense</Link>
          </Button>
        }
      />
      <div className="p-6 space-y-4">
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
          <Card className="shadow-[var(--shadow-card)]"><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total expenses</p>
            <p className="text-lg font-semibold num">{formatMoney(totals.total)}</p>
          </CardContent></Card>
          <Card className="shadow-[var(--shadow-card)]"><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">This month</p>
            <p className="text-lg font-semibold num">{formatMoney(totals.month)}</p>
          </CardContent></Card>
          <Card className="shadow-[var(--shadow-card)]"><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Records</p>
            <p className="text-lg font-semibold num">{totals.count}</p>
          </CardContent></Card>
        </div>

        <Card className="shadow-[var(--shadow-card)] p-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search reference, notes, category…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </Card>

        <Card className="shadow-[var(--shadow-card)]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Date</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Paid from</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Reference / Notes</TableHead>
                <TableHead className="w-20">Mode</TableHead>
                <TableHead className="text-right w-32">Amount</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-10">Loading…</TableCell></TableRow>
              )}
              {!loading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12">
                    <Receipt className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">No expenses recorded yet.</p>
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(r.expense_date)}</TableCell>
                  <TableCell className="font-medium">
                    {r.category ? (
                      <span><span className="text-muted-foreground num mr-2">{r.category.code ?? "—"}</span>{r.category.name}</span>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {r.paid_from ? `${r.paid_from.code ?? ""} ${r.paid_from.name}`.trim() : "—"}
                  </TableCell>
                  <TableCell className="text-sm">{r.contact?.name ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                    {r.reference ? <span className="font-medium text-foreground">{r.reference}</span> : null}
                    {r.reference && r.notes ? " · " : null}
                    {r.notes}
                    {!r.reference && !r.notes ? "—" : null}
                  </TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px] capitalize">{r.mode}</Badge></TableCell>
                  <TableCell className="text-right num font-medium">{formatMoney(r.amount)}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" title="Delete" onClick={() => handleDelete(r.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </>
  );
};

export default Expenses;
