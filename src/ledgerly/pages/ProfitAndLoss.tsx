import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/ledgerly/integrations/supabase/client";
import { PageHeader } from "@/ledgerly/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatMoney } from "@/ledgerly/lib/format";
import { Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCompany } from "@/ledgerly/contexts/CompanyContext";
import { fetchAllJournalLines } from "@/ledgerly/lib/fetchAllJournalLines";

type AccountType = "asset" | "liability" | "equity" | "income" | "expense";

interface Account {
  id: string;
  code: string | null;
  name: string;
  type: AccountType;
}

interface Row { id: string; code: string | null; name: string; amount: number; }

const todayISO = () => new Date().toISOString().slice(0, 10);
const firstOfYearISO = () => {
  const d = new Date(); d.setMonth(0); d.setDate(1);
  return d.toISOString().slice(0, 10);
};

const COGS_CODE = "5000";

const ProfitAndLoss = () => {
  const { companyId } = useCompany();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [from, setFrom] = useState(firstOfYearISO());
  const [to, setTo] = useState(todayISO());
  const [periodMap, setPeriodMap] = useState<Record<string, { d: number; c: number }>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!companyId) return;
    (async () => {
      const { data, error } = await supabase
        .from("accounts").select("id, code, name, type").eq("company_id", companyId).eq("is_active", true)
        .in("type", ["income", "expense"])
        .order("code", { nullsFirst: false }).order("name");
      if (error) { toast.error(error.message); return; }
      setAccounts((data ?? []) as Account[]);
    })();
  }, [companyId]);

  useEffect(() => {
    if (!companyId) return;
    (async () => {
      setLoading(true);
      try {
        const rows = await fetchAllJournalLines(companyId, from, to);
        const map: Record<string, { d: number; c: number }> = {};
        rows.forEach((r) => {
          const cur = map[r.account_id] ?? { d: 0, c: 0 };
          cur.d += r.debit;
          cur.c += r.credit;
          map[r.account_id] = cur;
        });
        setPeriodMap(map);
      } catch (e: any) {
        toast.error(e?.message ?? "Failed to load profit & loss");
      } finally {
        setLoading(false);
      }
    })();
  }, [from, to, companyId]);

  const { incomeRows, cogsRows, expenseRows, totalIncome, totalCOGS, totalExpenses, totalDebit, totalCredit, netProfit, netLoss } = useMemo(() => {
    const income: Row[] = [];
    const cogs: Row[] = [];
    const expense: Row[] = [];

    accounts.forEach((a) => {
      const p = periodMap[a.id] ?? { d: 0, c: 0 };
      const amount = a.type === "income" ? (p.c - p.d) : (p.d - p.c);
      if (Math.abs(amount) < 0.005) return;
      const row: Row = { id: a.id, code: a.code, name: a.name, amount };
      if (a.type === "income") income.push(row);
      else if (a.code === COGS_CODE) cogs.push(row);
      else expense.push(row);
    });

    const sortFn = (a: Row, b: Row) => (a.code ?? "").localeCompare(b.code ?? "");
    income.sort(sortFn); cogs.sort(sortFn); expense.sort(sortFn);

    const totalIncome = income.reduce((s, r) => s + r.amount, 0);
    const totalCOGS = cogs.reduce((s, r) => s + r.amount, 0);
    const totalExpenses = expense.reduce((s, r) => s + r.amount, 0);
    const net = totalIncome - totalCOGS - totalExpenses;
    const netProfit = net > 0 ? net : 0;
    const netLoss = net < 0 ? -net : 0;
    const totalDebit = totalCOGS + totalExpenses + netProfit;
    const totalCredit = totalIncome + netLoss;

    return { incomeRows: income, cogsRows: cogs, expenseRows: expense, totalIncome, totalCOGS, totalExpenses, totalDebit, totalCredit, netProfit, netLoss };
  }, [accounts, periodMap]);

  const exportCSV = () => {
    const lines: string[][] = [["Side", "Section", "Code", "Account", "Amount"]];
    cogsRows.forEach((r) => lines.push(["Dr", "Cost of Goods Sold", r.code ?? "", r.name, r.amount.toFixed(2)]));
    expenseRows.forEach((r) => lines.push(["Dr", "Operating Expenses", r.code ?? "", r.name, r.amount.toFixed(2)]));
    if (netProfit > 0) lines.push(["Dr", "", "", "Net Profit c/d", netProfit.toFixed(2)]);
    lines.push(["", "", "", "Total Debit", totalDebit.toFixed(2)]);
    incomeRows.forEach((r) => lines.push(["Cr", "Income", r.code ?? "", r.name, r.amount.toFixed(2)]));
    if (netLoss > 0) lines.push(["Cr", "", "", "Net Loss c/d", netLoss.toFixed(2)]);
    lines.push(["", "", "", "Total Credit", totalCredit.toFixed(2)]);
    const csv = lines.map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `profit-loss-${from}-to-${to}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const SideTable = ({ side, title, groups, totalLabel, total, balancing }: {
    side: "Dr" | "Cr";
    title: string;
    groups: Array<{ heading: string; rows: Row[]; subtotal?: { label: string; amount: number } }>;
    totalLabel: string;
    total: number;
    balancing?: { label: string; amount: number } | null;
  }) => (
    <div className="border rounded-md overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b">
        <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{side} — {title}</span>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-muted/20 border-b">
          <tr>
            <th className="text-left px-4 py-2 w-20 text-xs font-medium text-muted-foreground">Code</th>
            <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Particulars</th>
            <th className="text-right px-4 py-2 w-32 text-xs font-medium text-muted-foreground">Amount</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <>
              <tr key={`${g.heading}-h`} className="bg-muted/10">
                <td colSpan={3} className="px-4 py-1.5 text-xs uppercase tracking-wide text-muted-foreground font-semibold">{g.heading}</td>
              </tr>
              {g.rows.length === 0 ? (
                <tr><td colSpan={3} className="px-4 py-2 pl-8 italic text-xs text-muted-foreground">— none —</td></tr>
              ) : g.rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-4 py-2 num text-xs text-muted-foreground">{r.code ?? "—"}</td>
                  <td className="px-4 py-2 pl-6">{r.name}</td>
                  <td className="px-4 py-2 text-right num">{formatMoney(r.amount)}</td>
                </tr>
              ))}
              {g.subtotal && (
                <tr className="border-t font-medium bg-muted/5">
                  <td colSpan={2} className="px-4 py-2 pl-6 text-sm">{g.subtotal.label}</td>
                  <td className="px-4 py-2 text-right num">{formatMoney(g.subtotal.amount)}</td>
                </tr>
              )}
            </>
          ))}
          {balancing && (
            <tr className="border-t font-semibold bg-primary/5 italic">
              <td colSpan={2} className="px-4 py-2">{balancing.label}</td>
              <td className="px-4 py-2 text-right num">{formatMoney(balancing.amount)}</td>
            </tr>
          )}
          <tr className="border-t-2 font-bold bg-primary/10 text-base">
            <td colSpan={2} className="px-4 py-2.5">{totalLabel}</td>
            <td className="px-4 py-2.5 text-right num">{formatMoney(total)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      <PageHeader
        title="Profit & Loss"
        description="Traditional T-form: expenses (Dr) on the left, income (Cr) on the right"
        actions={
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-2" />Export CSV
          </Button>
        }
      />
      <div className="p-6 space-y-4">
        <Card className="shadow-[var(--shadow-card)]">
          <CardContent className="p-5 grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label>From</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>To</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
          <Card className="shadow-[var(--shadow-card)]"><CardContent className="p-4 min-w-0">
            <p className="text-xs text-muted-foreground truncate">Total Income (Cr)</p>
            <p className="text-base md:text-lg font-semibold num truncate">{formatMoney(totalIncome)}</p>
          </CardContent></Card>
          <Card className="shadow-[var(--shadow-card)]"><CardContent className="p-4 min-w-0">
            <p className="text-xs text-muted-foreground truncate">Total Expenses (Dr)</p>
            <p className="text-base md:text-lg font-semibold num truncate">{formatMoney(totalCOGS + totalExpenses)}</p>
          </CardContent></Card>
          <Card className="shadow-[var(--shadow-card)]"><CardContent className="p-4 min-w-0">
            <p className="text-xs text-muted-foreground truncate">{netLoss > 0 ? "Net Loss" : "Net Profit"}</p>
            <p className={cn("text-lg md:text-xl font-bold num truncate", netLoss > 0 ? "text-destructive" : "text-primary")}>
              {formatMoney(netLoss > 0 ? netLoss : netProfit)}
            </p>
          </CardContent></Card>
        </div>

        {loading ? (
          <Card className="shadow-[var(--shadow-card)]"><CardContent className="p-10 text-center text-sm text-muted-foreground">Loading…</CardContent></Card>
        ) : (
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
            <SideTable
              side="Dr"
              title="Expenses"
              groups={[
                { heading: "Cost of Goods Sold", rows: cogsRows, subtotal: cogsRows.length > 0 ? { label: "Total COGS", amount: totalCOGS } : undefined },
                { heading: "Operating Expenses", rows: expenseRows, subtotal: expenseRows.length > 0 ? { label: "Total Operating Expenses", amount: totalExpenses } : undefined },
              ]}
              totalLabel="Total"
              total={totalDebit}
              balancing={netProfit > 0 ? { label: "To Net Profit c/d", amount: netProfit } : null}
            />
            <SideTable
              side="Cr"
              title="Income"
              groups={[
                { heading: "Revenue", rows: incomeRows, subtotal: incomeRows.length > 0 ? { label: "Total Income", amount: totalIncome } : undefined },
              ]}
              totalLabel="Total"
              total={totalCredit}
              balancing={netLoss > 0 ? { label: "By Net Loss c/d", amount: netLoss } : null}
            />
          </div>
        )}
      </div>
    </>
  );
};

export default ProfitAndLoss;
