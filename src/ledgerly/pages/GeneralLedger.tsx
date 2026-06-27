import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/ledgerly/integrations/supabase/client";
import { PageHeader } from "@/ledgerly/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { formatMoney } from "@/ledgerly/lib/format";
import { useCompany } from "@/ledgerly/contexts/CompanyContext";

type AccountType = "asset" | "liability" | "equity" | "income" | "expense";

interface Account {
  id: string;
  code: string | null;
  name: string;
  type: AccountType;
}

interface LineRow {
  id: string;
  debit: number;
  credit: number;
  description: string | null;
  entry: {
    id: string;
    entry_date: string;
    reference: string | null;
    narration: string | null;
    source_type: string | null;
    source_id: string | null;
  } | null;
  contact: { name: string } | null;
}

const isDebitNatural = (t: AccountType) => t === "asset" || t === "expense";

const todayISO = () => new Date().toISOString().slice(0, 10);
const firstOfYearISO = () => {
  const d = new Date(); d.setMonth(0); d.setDate(1);
  return d.toISOString().slice(0, 10);
};

const sourceLink = (sourceType: string | null, sourceId: string | null): string | null => {
  if (!sourceType || !sourceId) return null;
  if (sourceType === "bill") return `/ledgerly/bills/${sourceId}`;
  if (sourceType === "invoice") return `/ledgerly/invoices/${sourceId}`;
  return null;
};

const GeneralLedger = () => {
  const { companyId } = useCompany();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState<string>("");
  const [from, setFrom] = useState(firstOfYearISO());
  const [to, setTo] = useState(todayISO());
  const [openingBalance, setOpeningBalance] = useState(0);
  const [lines, setLines] = useState<LineRow[]>([]);
  const [loading, setLoading] = useState(false);

  // Load accounts
  useEffect(() => {
    if (!companyId) return;
    (async () => {
      const { data, error } = await supabase
        .from("accounts").select("id, code, name, type").eq("company_id", companyId).eq("is_active", true)
        .order("code", { nullsFirst: false }).order("name");
      if (error) { toast.error(error.message); return; }
      setAccounts((data ?? []) as Account[]);
      if (data && data.length > 0 && !accountId) setAccountId(data[0].id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const account = useMemo(() => accounts.find((a) => a.id === accountId), [accounts, accountId]);

  // Load lines + opening balance
  useEffect(() => {
    if (!accountId) return;
    (async () => {
      setLoading(true);
      // Opening balance: sum of all journal_lines for this account with entry_date < from
      const { data: opening, error: oErr } = await supabase
        .from("journal_lines")
        .select("debit, credit, entry:journal_entries!inner(entry_date)")
        .eq("account_id", accountId)
        .lt("entry.entry_date", from);
      if (oErr) { toast.error(oErr.message); setLoading(false); return; }
      const opSum = (opening ?? []).reduce(
        (s, r) => s + (Number(r.debit) - Number(r.credit)), 0,
      );
      setOpeningBalance(opSum);

      // Period lines
      const { data, error } = await supabase
        .from("journal_lines")
        .select(`
          id, debit, credit, description,
          entry:journal_entries!inner(id, entry_date, reference, narration, source_type, source_id),
          contact:contacts(name)
        `)
        .eq("account_id", accountId)
        .gte("entry.entry_date", from)
        .lte("entry.entry_date", to)
        .order("entry_date", { foreignTable: "journal_entries", ascending: true })
        .order("created_at", { ascending: true });
      if (error) { toast.error(error.message); setLoading(false); return; }
      setLines((data ?? []) as unknown as LineRow[]);
      setLoading(false);
    })();
  }, [accountId, from, to]);

  // Compute running balance and totals (reverse so newest is on top)
  const { rows, totalDebit, totalCredit, closingBalance } = useMemo(() => {
    const debitNatural = account ? isDebitNatural(account.type) : true;
    let bal = openingBalance;
    let td = 0, tc = 0;
    const chronological = lines.map((l) => {
      const d = Number(l.debit), c = Number(l.credit);
      bal += debitNatural ? (d - c) : (c - d);
      td += d; tc += c;
      return { ...l, running: bal };
    });
    return { rows: [...chronological].reverse(), totalDebit: td, totalCredit: tc, closingBalance: bal };
  }, [lines, openingBalance, account]);

  // Display the opening balance with sign based on natural side
  const openingDisplay = useMemo(() => {
    if (!account) return openingBalance;
    return isDebitNatural(account.type) ? openingBalance : -openingBalance;
  }, [openingBalance, account]);

  const balanceTone = (n: number) =>
    n >= 0 ? "text-foreground" : "text-destructive";

  return (
    <>
      <PageHeader
        title="General Ledger"
        description="Every journal line for an account, with running balance"
      />
      <div className="p-6 space-y-4">
        <Card className="shadow-[var(--shadow-card)]">
          <CardContent className="p-5 grid gap-4 md:grid-cols-4">
            <div className="space-y-2 md:col-span-2">
              <Label>Account</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                <SelectContent className="max-h-80">
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      <span className="text-muted-foreground mr-2 num">{a.code ?? "—"}</span>
                      {a.name}
                      <span className="ml-2 text-[10px] uppercase text-muted-foreground">{a.type}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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

        {account && (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-4">
            <Card className="shadow-[var(--shadow-card)]"><CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Opening balance</p>
              <p className={`text-lg font-semibold num ${balanceTone(openingDisplay)}`}>{formatMoney(openingDisplay)}</p>
            </CardContent></Card>
            <Card className="shadow-[var(--shadow-card)]"><CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Period debits</p>
              <p className="text-lg font-semibold num">{formatMoney(totalDebit)}</p>
            </CardContent></Card>
            <Card className="shadow-[var(--shadow-card)]"><CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Period credits</p>
              <p className="text-lg font-semibold num">{formatMoney(totalCredit)}</p>
            </CardContent></Card>
            <Card className="shadow-[var(--shadow-card)]"><CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Closing balance</p>
              <p className={`text-lg font-semibold num ${balanceTone(isDebitNatural(account.type) ? closingBalance : -closingBalance)}`}>
                {formatMoney(isDebitNatural(account.type) ? closingBalance : -closingBalance)}
              </p>
            </CardContent></Card>
          </div>
        )}

        <Card className="shadow-[var(--shadow-card)]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Date</TableHead>
                <TableHead>Reference / Narration</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead className="w-24">Source</TableHead>
                <TableHead className="text-right w-32">Debit</TableHead>
                <TableHead className="text-right w-32">Credit</TableHead>
                <TableHead className="text-right w-36">Running</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const link = sourceLink(r.entry?.source_type ?? null, r.entry?.source_id ?? null);
                const display = account && !isDebitNatural(account.type) ? -r.running : r.running;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm text-muted-foreground">{r.entry?.entry_date ?? "—"}</TableCell>
                    <TableCell>
                      <div className="text-sm">{r.entry?.reference ?? r.entry?.narration ?? "—"}</div>
                      {r.description && <div className="text-xs text-muted-foreground">{r.description}</div>}
                    </TableCell>
                    <TableCell className="text-sm">{r.contact?.name ?? "—"}</TableCell>
                    <TableCell>
                      {link ? (
                        <Link to={link} className="text-primary hover:underline text-xs capitalize">{r.entry?.source_type}</Link>
                      ) : (
                        <Badge variant="outline" className="text-[10px] capitalize">{r.entry?.source_type ?? "manual"}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right num">{Number(r.debit) > 0 ? formatMoney(r.debit) : "—"}</TableCell>
                    <TableCell className="text-right num">{Number(r.credit) > 0 ? formatMoney(r.credit) : "—"}</TableCell>
                    <TableCell className={`text-right num font-medium ${balanceTone(display)}`}>{formatMoney(display)}</TableCell>
                  </TableRow>
                );
              })}
              {rows.length === 0 && !loading && (
                <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-10">No transactions in this period.</TableCell></TableRow>
              )}
              {loading && (
                <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-10">Loading…</TableCell></TableRow>
              )}
              <TableRow className="bg-muted/30">
                <TableCell colSpan={6} className="text-sm text-muted-foreground italic">Opening balance as of {from}</TableCell>
                <TableCell className={`text-right num font-medium ${balanceTone(openingDisplay)}`}>
                  {formatMoney(openingDisplay)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Card>
      </div>
    </>
  );
};

export default GeneralLedger;
