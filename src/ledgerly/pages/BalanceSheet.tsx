import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/ledgerly/integrations/supabase/client";
import { PageHeader } from "@/ledgerly/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatMoney } from "@/ledgerly/lib/format";
import { Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCompany } from "@/ledgerly/contexts/CompanyContext";

type AccountType = "asset" | "liability" | "equity" | "income" | "expense";

interface Account {
  id: string;
  code: string | null;
  name: string;
  type: AccountType;
}

interface Row { id: string; code: string | null; name: string; amount: number; }

const todayISO = () => new Date().toISOString().slice(0, 10);

const BalanceSheet = () => {
  const { companyId } = useCompany();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [asOf, setAsOf] = useState(todayISO());
  const [balanceMap, setBalanceMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!companyId) return;
    (async () => {
      const { data, error } = await supabase
        .from("accounts").select("id, code, name, type").eq("company_id", companyId).eq("is_active", true)
        .order("code", { nullsFirst: false }).order("name");
      if (error) { toast.error(error.message); return; }
      setAccounts((data ?? []) as Account[]);
    })();
  }, [companyId]);

  useEffect(() => {
    if (!companyId) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("journal_lines")
        .select("account_id, debit, credit, entry:journal_entries!inner(entry_date)")
        .eq("company_id", companyId)
        .lte("entry.entry_date", asOf);
      if (error) { toast.error(error.message); setLoading(false); return; }
      const map: Record<string, number> = {};
      (data ?? []).forEach((r: any) => {
        const v = Number(r.debit) - Number(r.credit);
        map[r.account_id] = (map[r.account_id] ?? 0) + v;
      });
      setBalanceMap(map);
      setLoading(false);
    })();
  }, [asOf, companyId]);

  const { assets, liabilities, equity, totalAssets, totalLiabilities, totalEquity, netIncome, totalLiabEq, difference, balanced } = useMemo(() => {
    const assets: Row[] = [];
    const liabilities: Row[] = [];
    const equity: Row[] = [];
    let income = 0, expense = 0;

    accounts.forEach((a) => {
      const signed = balanceMap[a.id] ?? 0;
      if (a.type === "asset") {
        if (Math.abs(signed) >= 0.005) assets.push({ id: a.id, code: a.code, name: a.name, amount: signed });
      } else if (a.type === "liability") {
        const amt = -signed;
        if (Math.abs(amt) >= 0.005) liabilities.push({ id: a.id, code: a.code, name: a.name, amount: amt });
      } else if (a.type === "equity") {
        const amt = -signed;
        if (Math.abs(amt) >= 0.005) equity.push({ id: a.id, code: a.code, name: a.name, amount: amt });
      } else if (a.type === "income") {
        income += -signed;
      } else if (a.type === "expense") {
        expense += signed;
      }
    });

    const sortFn = (a: Row, b: Row) => (a.code ?? "").localeCompare(b.code ?? "");
    assets.sort(sortFn); liabilities.sort(sortFn); equity.sort(sortFn);

    const netIncome = income - expense;
    const totalAssets = assets.reduce((s, r) => s + r.amount, 0);
    const totalLiabilities = liabilities.reduce((s, r) => s + r.amount, 0);
    const totalEquity = equity.reduce((s, r) => s + r.amount, 0);
    const totalLiabEq = totalLiabilities + totalEquity + netIncome;
    const difference = totalAssets - totalLiabEq;
    const balanced = Math.abs(difference) < 0.01;

    return { assets, liabilities, equity, totalAssets, totalLiabilities, totalEquity, netIncome, totalLiabEq, difference, balanced };
  }, [accounts, balanceMap]);

  const exportCSV = () => {
    const lines: string[][] = [["Side", "Section", "Code", "Account", "Amount"]];
    liabilities.forEach((r) => lines.push(["Liabilities & Equity", "Liabilities", r.code ?? "", r.name, r.amount.toFixed(2)]));
    equity.forEach((r) => lines.push(["Liabilities & Equity", "Equity", r.code ?? "", r.name, r.amount.toFixed(2)]));
    lines.push(["", "", "", "Current Period Net Income", netIncome.toFixed(2)]);
    lines.push(["", "", "", "Total Liabilities + Equity", totalLiabEq.toFixed(2)]);
    assets.forEach((r) => lines.push(["Assets", "Assets", r.code ?? "", r.name, r.amount.toFixed(2)]));
    lines.push(["", "", "", "Total Assets", totalAssets.toFixed(2)]);
    const csv = lines.map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `balance-sheet-${asOf}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const SideTable = ({ side, title, groups, totalLabel, total, totalIsOff }: {
    side: string;
    title: string;
    groups: Array<{ heading: string; rows: Row[]; extra?: { label: string; amount: number; italic?: boolean }; subtotal?: { label: string; amount: number } }>;
    totalLabel: string;
    total: number;
    totalIsOff?: boolean;
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
              {g.rows.length === 0 && !g.extra ? (
                <tr><td colSpan={3} className="px-4 py-2 pl-8 italic text-xs text-muted-foreground">— none —</td></tr>
              ) : g.rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-4 py-2 num text-xs text-muted-foreground">{r.code ?? "—"}</td>
                  <td className="px-4 py-2 pl-6">{r.name}</td>
                  <td className={cn("px-4 py-2 text-right num", r.amount < 0 && "text-destructive")}>{formatMoney(r.amount)}</td>
                </tr>
              ))}
              {g.extra && (
                <tr className="border-t">
                  <td className="px-4 py-2 num text-xs text-muted-foreground">—</td>
                  <td className={cn("px-4 py-2 pl-6", g.extra.italic && "italic")}>{g.extra.label}</td>
                  <td className={cn("px-4 py-2 text-right num", g.extra.amount < 0 && "text-destructive")}>{formatMoney(g.extra.amount)}</td>
                </tr>
              )}
              {g.subtotal && (
                <tr className="border-t font-medium bg-muted/5">
                  <td colSpan={2} className="px-4 py-2 pl-6 text-sm">{g.subtotal.label}</td>
                  <td className="px-4 py-2 text-right num">{formatMoney(g.subtotal.amount)}</td>
                </tr>
              )}
            </>
          ))}
          <tr className="border-t-2 font-bold bg-primary/10 text-base">
            <td colSpan={2} className="px-4 py-2.5">{totalLabel}</td>
            <td className={cn("px-4 py-2.5 text-right num", totalIsOff && "text-destructive")}>{formatMoney(total)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      <PageHeader
        title="Balance Sheet"
        description="Traditional horizontal form: liabilities & equity (left) and assets (right)"
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
              <Label>As of</Label>
              <Input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
          <Card className="shadow-[var(--shadow-card)]"><CardContent className="p-4 min-w-0">
            <p className="text-xs text-muted-foreground truncate">Total Assets</p>
            <p className="text-base md:text-lg font-semibold num truncate">{formatMoney(totalAssets)}</p>
          </CardContent></Card>
          <Card className="shadow-[var(--shadow-card)]"><CardContent className="p-4 min-w-0">
            <p className="text-xs text-muted-foreground truncate">Liabilities + Equity</p>
            <p className="text-base md:text-lg font-semibold num truncate">{formatMoney(totalLiabEq)}</p>
          </CardContent></Card>
          <Card className="shadow-[var(--shadow-card)]"><CardContent className="p-4 flex items-center justify-between gap-2 min-w-0">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground truncate">Equation check</p>
              <p className={cn("text-sm num truncate", !balanced && "text-destructive")}>
                {balanced ? "Assets = Liab + Equity" : `Off by ${formatMoney(Math.abs(difference))}`}
              </p>
            </div>
            <Badge variant={balanced ? "default" : "destructive"} className="shrink-0">{balanced ? "Balanced" : "Unbalanced"}</Badge>
          </CardContent></Card>
        </div>

        {loading ? (
          <Card className="shadow-[var(--shadow-card)]"><CardContent className="p-10 text-center text-sm text-muted-foreground">Loading…</CardContent></Card>
        ) : (
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
            <SideTable
              side="Liabilities & Equity"
              title="Sources of funds"
              groups={[
                { heading: "Liabilities", rows: liabilities, subtotal: liabilities.length > 0 ? { label: "Total Liabilities", amount: totalLiabilities } : undefined },
                {
                  heading: "Equity",
                  rows: equity,
                  extra: { label: "Current Period Net Income", amount: netIncome, italic: true },
                  subtotal: { label: "Total Equity (incl. net income)", amount: totalEquity + netIncome },
                },
              ]}
              totalLabel="Total Liabilities + Equity"
              total={totalLiabEq}
              totalIsOff={!balanced}
            />
            <SideTable
              side="Assets"
              title="Application of funds"
              groups={[
                { heading: "Assets", rows: assets, subtotal: assets.length > 0 ? { label: "Total Assets", amount: totalAssets } : undefined },
              ]}
              totalLabel="Total Assets"
              total={totalAssets}
              totalIsOff={!balanced}
            />
          </div>
        )}

        {!balanced && (
          <Card className="shadow-[var(--shadow-card)] border-destructive/50">
            <CardContent className="p-4 text-sm text-destructive">
              Out of balance by {formatMoney(Math.abs(difference))}
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
};

export default BalanceSheet;
