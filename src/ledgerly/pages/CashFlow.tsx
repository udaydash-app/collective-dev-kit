import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/ledgerly/integrations/supabase/client";
import { PageHeader } from "@/ledgerly/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatMoney } from "@/ledgerly/lib/format";
import { Download, ArrowDownCircle, ArrowUpCircle, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCompany } from "@/ledgerly/contexts/CompanyContext";

type AccountType = "asset" | "liability" | "equity" | "income" | "expense";
interface Account { id: string; code: string | null; name: string; type: AccountType; }

const todayISO = () => new Date().toISOString().slice(0, 10);
const firstOfYearISO = () => { const d = new Date(); d.setMonth(0); d.setDate(1); return d.toISOString().slice(0, 10); };

// Codes that count as "Cash & Cash Equivalents"
const CASH_CODES = new Set(["1000", "1010"]);
// Operating contra accounts (working capital + P&L)
const OPERATING_CODES = new Set(["1100", "1200", "2000", "2100"]); // AR, Inventory, AP, Tax Payable

type Section = "operating" | "investing" | "financing";

const classify = (a: Account): Section => {
  if (a.code && OPERATING_CODES.has(a.code)) return "operating";
  if (a.type === "income" || a.type === "expense") return "operating";
  if (a.type === "equity") return "financing";
  if (a.type === "liability") return "financing"; // long-term liabilities (loans)
  if (a.type === "asset") return "investing"; // non-cash, non-working-capital assets
  return "operating";
};

interface Row { account: Account; amount: number; }

const CashFlow = () => {
  const { companyId } = useCompany();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [from, setFrom] = useState(firstOfYearISO());
  const [to, setTo] = useState(todayISO());
  const [loading, setLoading] = useState(false);
  const [openingCash, setOpeningCash] = useState(0);
  const [contraMap, setContraMap] = useState<Record<string, number>>({});

  // Load accounts
  useEffect(() => {
    if (!companyId) return;
    (async () => {
      const { data, error } = await supabase
        .from("accounts").select("id, code, name, type").eq("company_id", companyId)
        .order("code", { nullsFirst: false }).order("name");
      if (error) { toast.error(error.message); return; }
      setAccounts((data ?? []) as Account[]);
    })();
  }, [companyId]);

  // Load journal data
  useEffect(() => {
    if (accounts.length === 0 || !companyId) return;
    (async () => {
      setLoading(true);
      const cashIds = new Set(accounts.filter((a) => a.code && CASH_CODES.has(a.code)).map((a) => a.id));
      if (cashIds.size === 0) {
        setOpeningCash(0); setContraMap({}); setLoading(false); return;
      }

      // Fetch ALL journal entries up to "to" date with their lines (we'll split by date for opening vs period)
      const { data, error } = await supabase
        .from("journal_entries")
        .select("id, entry_date, lines:journal_lines(account_id, debit, credit)")
        .eq("company_id", companyId)
        .lte("entry_date", to)
        .order("entry_date");
      if (error) { toast.error(error.message); setLoading(false); return; }

      let opening = 0;
      const contras: Record<string, number> = {};

      (data ?? []).forEach((entry: any) => {
        const lines: Array<{ account_id: string; debit: number; credit: number }> = entry.lines ?? [];
        const beforePeriod = entry.entry_date < from;

        // Cash net change for this entry (debit increases cash, credit decreases)
        let cashDelta = 0;
        const contraLines: Array<{ account_id: string; debit: number; credit: number }> = [];
        lines.forEach((l) => {
          if (cashIds.has(l.account_id)) {
            cashDelta += Number(l.debit) - Number(l.credit);
          } else {
            contraLines.push(l);
          }
        });

        if (beforePeriod) {
          opening += cashDelta;
          return;
        }

        // In-period: cashDelta represents inflow(+)/outflow(-) of cash.
        // Allocate to contra accounts proportionally by their net movement (sign-aware).
        if (cashDelta === 0 || contraLines.length === 0) return;

        // Compute each contra's "movement" — credit means cash came IN from that source,
        // debit means cash went OUT to that destination.
        // contribution = credit - debit (matches cash inflow sign)
        const contributions = contraLines.map((l) => ({
          account_id: l.account_id,
          contribution: Number(l.credit) - Number(l.debit),
        }));
        const totalContribution = contributions.reduce((s, c) => s + c.contribution, 0);

        if (Math.abs(totalContribution) < 0.005) {
          // Pure cash entry (e.g. cash <-> bank transfer). Net cash effect was already counted.
          // No contra movement to classify.
          return;
        }

        // Scale contributions so they sum to cashDelta (handles tax-inclusive entries cleanly).
        const scale = cashDelta / totalContribution;
        contributions.forEach((c) => {
          contras[c.account_id] = (contras[c.account_id] ?? 0) + c.contribution * scale;
        });
      });

      setOpeningCash(opening);
      setContraMap(contras);
      setLoading(false);
    })();
  }, [accounts, from, to, companyId]);

  const { sections, netChange, closingCash } = useMemo(() => {
    const buckets: Record<Section, Row[]> = { operating: [], investing: [], financing: [] };
    accounts.forEach((a) => {
      if (a.code && CASH_CODES.has(a.code)) return;
      const amount = contraMap[a.id] ?? 0;
      if (Math.abs(amount) < 0.005) return;
      buckets[classify(a)].push({ account: a, amount });
    });
    const sortFn = (a: Row, b: Row) => (a.account.code ?? "").localeCompare(b.account.code ?? "");
    (Object.keys(buckets) as Section[]).forEach((k) => buckets[k].sort(sortFn));

    const totals = {
      operating: buckets.operating.reduce((s, r) => s + r.amount, 0),
      investing: buckets.investing.reduce((s, r) => s + r.amount, 0),
      financing: buckets.financing.reduce((s, r) => s + r.amount, 0),
    };
    const netChange = totals.operating + totals.investing + totals.financing;
    return {
      sections: [
        { key: "operating" as Section, title: "Operating Activities", rows: buckets.operating, total: totals.operating },
        { key: "investing" as Section, title: "Investing Activities", rows: buckets.investing, total: totals.investing },
        { key: "financing" as Section, title: "Financing Activities", rows: buckets.financing, total: totals.financing },
      ],
      netChange,
      closingCash: openingCash + netChange,
    };
  }, [accounts, contraMap, openingCash]);

  const exportCSV = () => {
    const lines: string[][] = [["Section", "Code", "Account", "Amount"]];
    sections.forEach((s) => {
      s.rows.forEach((r) => lines.push([s.title, r.account.code ?? "", r.account.name, r.amount.toFixed(2)]));
      lines.push(["", "", `Net cash from ${s.title}`, s.total.toFixed(2)]);
    });
    lines.push(["", "", "Net Change in Cash", netChange.toFixed(2)]);
    lines.push(["", "", "Opening Cash", openingCash.toFixed(2)]);
    lines.push(["", "", "Closing Cash", closingCash.toFixed(2)]);
    const csv = lines.map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `cash-flow-${from}-to-${to}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader
        title="Cash Flow Statement"
        description="Cash inflows and outflows by activity for the selected period"
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

        <div className="grid gap-4 grid-cols-1 sm:grid-cols-4">
          <Card className="shadow-[var(--shadow-card)]"><CardContent className="p-4 min-w-0">
            <div className="flex items-center gap-2 text-xs text-muted-foreground truncate"><Wallet className="h-3.5 w-3.5 shrink-0" />Opening Cash</div>
            <p className="text-base md:text-lg font-semibold num mt-1 truncate" title={formatMoney(openingCash)}>{formatMoney(openingCash)}</p>
          </CardContent></Card>
          <Card className="shadow-[var(--shadow-card)]"><CardContent className="p-4 min-w-0">
            <div className="flex items-center gap-2 text-xs text-muted-foreground truncate">
              {netChange >= 0 ? <ArrowUpCircle className="h-3.5 w-3.5 text-success shrink-0" /> : <ArrowDownCircle className="h-3.5 w-3.5 text-destructive shrink-0" />}
              Net Change
            </div>
            <p className={cn("text-base md:text-lg font-semibold num mt-1 truncate", netChange < 0 && "text-destructive", netChange > 0 && "text-success")} title={formatMoney(netChange)}>{formatMoney(netChange)}</p>
          </CardContent></Card>
          <Card className="shadow-[var(--shadow-card)] sm:col-span-2"><CardContent className="p-4 min-w-0">
            <div className="flex items-center gap-2 text-xs text-muted-foreground truncate"><Wallet className="h-3.5 w-3.5 shrink-0" />Closing Cash</div>
            <p className={cn("text-lg md:text-xl font-bold num mt-1 truncate", closingCash < 0 ? "text-destructive" : "text-primary")} title={formatMoney(closingCash)}>{formatMoney(closingCash)}</p>
          </CardContent></Card>
        </div>

        <Card className="shadow-[var(--shadow-card)]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Code</TableHead>
                <TableHead>Account</TableHead>
                <TableHead className="text-right w-40">Inflow / (Outflow)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-10">Loading…</TableCell></TableRow>
              ) : (
                <>
                  {sections.map((s) => (
                    <SectionBlock key={s.key} title={s.title} rows={s.rows} total={s.total} />
                  ))}
                  <TableRow className="bg-primary/5 font-semibold border-t-2">
                    <TableCell colSpan={2}>Net Change in Cash</TableCell>
                    <TableCell className={cn("text-right num", netChange < 0 && "text-destructive")}>{formatMoney(netChange)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={2} className="text-sm text-muted-foreground pl-8">Opening cash balance</TableCell>
                    <TableCell className="text-right num">{formatMoney(openingCash)}</TableCell>
                  </TableRow>
                  <TableRow className="bg-primary/10 font-bold border-t-2 text-base">
                    <TableCell colSpan={2}>Closing cash balance</TableCell>
                    <TableCell className={cn("text-right num", closingCash < 0 ? "text-destructive" : "text-primary")}>{formatMoney(closingCash)}</TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </Card>

        <p className="text-xs text-muted-foreground px-1">
          Direct method: cash inflows (positive) and outflows (negative) are derived from journal entries that touch Cash (1000) or Bank (1010), classified by the contra account. Inter-cash transfers are excluded.
        </p>
      </div>
    </>
  );
};

const SectionBlock = ({ title, rows, total }: { title: string; rows: Row[]; total: number }) => (
  <>
    <TableRow className="bg-muted/30">
      <TableCell colSpan={3} className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">{title}</TableCell>
    </TableRow>
    {rows.length === 0 ? (
      <TableRow>
        <TableCell colSpan={3} className="text-sm text-muted-foreground italic pl-8">No activity in this period</TableCell>
      </TableRow>
    ) : rows.map((r) => (
      <TableRow key={r.account.id}>
        <TableCell className="num text-muted-foreground text-sm pl-8 w-24">{r.account.code ?? "—"}</TableCell>
        <TableCell>{r.account.name}</TableCell>
        <TableCell className={cn("text-right num", r.amount < 0 && "text-destructive")}>{formatMoney(r.amount)}</TableCell>
      </TableRow>
    ))}
    <TableRow className="border-t font-medium">
      <TableCell colSpan={2} className="pl-8 text-sm">Net cash from {title.toLowerCase()}</TableCell>
      <TableCell className={cn("text-right num", total < 0 && "text-destructive")}>{formatMoney(total)}</TableCell>
    </TableRow>
  </>
);

export default CashFlow;
