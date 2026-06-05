import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatMoney } from "@/lib/format";
import { Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCompany } from "@/contexts/CompanyContext";

type AccountType = "asset" | "liability" | "equity" | "income" | "expense";

interface Account {
  id: string;
  code: string | null;
  name: string;
  type: AccountType;
}

const todayISO = () => new Date().toISOString().slice(0, 10);
const firstOfYearISO = () => {
  const d = new Date(); d.setMonth(0); d.setDate(1);
  return d.toISOString().slice(0, 10);
};

const typeOrder: Record<AccountType, number> = {
  asset: 1, liability: 2, equity: 3, income: 4, expense: 5,
};

const TrialBalance = () => {
  const { companyId } = useCompany();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [asOf, setAsOf] = useState(todayISO());
  const [from, setFrom] = useState(firstOfYearISO());
  const [balanceMap, setBalanceMap] = useState<Record<string, { d: number; c: number }>>({});
  const [loading, setLoading] = useState(false);
  const [hideZero, setHideZero] = useState(true);

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
        .gte("entry.entry_date", from)
        .lte("entry.entry_date", asOf);
      if (error) { toast.error(error.message); setLoading(false); return; }
      const m: Record<string, { d: number; c: number }> = {};
      (data ?? []).forEach((r: any) => {
        const cur = m[r.account_id] ?? { d: 0, c: 0 };
        cur.d += Number(r.debit);
        cur.c += Number(r.credit);
        m[r.account_id] = cur;
      });
      setBalanceMap(m);
      setLoading(false);
    })();
  }, [from, asOf, companyId]);

  const rows = useMemo(() => {
    return accounts
      .map((a) => {
        const p = balanceMap[a.id] ?? { d: 0, c: 0 };
        const signed = p.d - p.c;
        const debit = signed > 0 ? signed : 0;
        const credit = signed < 0 ? -signed : 0;
        return { ...a, debit, credit };
      })
      .filter((r) => !hideZero || r.debit > 0.005 || r.credit > 0.005)
      .sort((a, b) => {
        const t = typeOrder[a.type] - typeOrder[b.type];
        if (t !== 0) return t;
        return (a.code ?? "").localeCompare(b.code ?? "");
      });
  }, [accounts, balanceMap, hideZero]);

  const totals = useMemo(
    () => rows.reduce((s, r) => ({ d: s.d + r.debit, c: s.c + r.credit }), { d: 0, c: 0 }),
    [rows],
  );
  const balanced = Math.abs(totals.d - totals.c) < 0.01;

  const exportCSV = () => {
    const header = ["Code", "Account", "Type", "Debit", "Credit"];
    const lines = rows.map((r) => [r.code ?? "", r.name, r.type, r.debit.toFixed(2), r.credit.toFixed(2)]);
    lines.push(["", "TOTAL", "", totals.d.toFixed(2), totals.c.toFixed(2)]);
    const csv = [header, ...lines].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `trial-balance-${from}-to-${asOf}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader
        title="Trial Balance"
        description="Traditional debit / credit listing of all account balances"
        actions={
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={rows.length === 0}>
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
              <Label>As of</Label>
              <Input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
            </div>
            <div className="space-y-2 md:col-span-2 flex items-end">
              <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                <input type="checkbox" checked={hideZero} onChange={(e) => setHideZero(e.target.checked)} />
                Hide accounts with zero balance
              </label>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-[var(--shadow-card)]">
          <CardContent className="p-4 flex items-center justify-between gap-2 min-w-0">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground truncate">Totals</p>
              <p className="text-sm num truncate">Dr {formatMoney(totals.d)} · Cr {formatMoney(totals.c)}</p>
            </div>
            <Badge variant={balanced ? "default" : "destructive"} className="shrink-0 whitespace-nowrap">
              {balanced ? "Balanced" : `Off by ${formatMoney(Math.abs(totals.d - totals.c))}`}
            </Badge>
          </CardContent>
        </Card>

        <Card className="shadow-[var(--shadow-card)]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Code</TableHead>
                <TableHead>Particulars</TableHead>
                <TableHead className="w-24">Type</TableHead>
                <TableHead className="text-right w-40">Debit (Dr)</TableHead>
                <TableHead className="text-right w-40">Credit (Cr)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-10">Loading…</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-10">No accounts to display.</TableCell></TableRow>
              ) : (
                <>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="num text-muted-foreground text-sm">{r.code ?? "—"}</TableCell>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] uppercase">{r.type}</Badge>
                      </TableCell>
                      <TableCell className="text-right num">{r.debit > 0 ? formatMoney(r.debit) : ""}</TableCell>
                      <TableCell className="text-right num">{r.credit > 0 ? formatMoney(r.credit) : ""}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-primary/10 font-bold border-t-2 text-base">
                    <TableCell colSpan={3} className="text-right">TOTAL</TableCell>
                    <TableCell className={cn("text-right num", !balanced && "text-destructive")}>{formatMoney(totals.d)}</TableCell>
                    <TableCell className={cn("text-right num", !balanced && "text-destructive")}>{formatMoney(totals.c)}</TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </>
  );
};

export default TrialBalance;
