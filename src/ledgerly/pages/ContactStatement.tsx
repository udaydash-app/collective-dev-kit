import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Printer, Download } from "lucide-react";
import { toast } from "sonner";
import { formatMoney, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ApplyCreditDialog } from "@/components/ApplyCreditDialog";
import { useCompany } from "@/contexts/CompanyContext";

type ContactType = "customer" | "supplier" | "both";
interface Contact {
  id: string; name: string; type: ContactType;
  email: string | null; phone: string | null; address: string | null;
  opening_balance: number;
}

type Kind = "customer" | "supplier";

interface Row {
  date: string;
  due: string | null;
  type: "Invoice" | "Bill" | "Receipt" | "Payment";
  ref: string;
  notes: string;
  link: string | null;
  debit: number;   // increases balance owed by/to contact
  credit: number;  // decreases it
}

const todayISO = () => new Date().toISOString().slice(0, 10);
const firstOfYearISO = () => { const d = new Date(); d.setMonth(0); d.setDate(1); return d.toISOString().slice(0, 10); };

const ContactStatement = () => {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { companyId, activeCompany } = useCompany();

  const [kind, setKind] = useState<Kind>((params.get("kind") as Kind) || "customer");
  const [contactId, setContactId] = useState<string>(params.get("contact") || "");
  const [from, setFrom] = useState(params.get("from") || firstOfYearISO());
  const [to, setTo] = useState(params.get("to") || todayISO());

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contact, setContact] = useState<Contact | null>(null);
  const [profile, setProfile] = useState<{ business_name: string; base_currency: string } | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [opening, setOpening] = useState(0);
  const [credit, setCredit] = useState(0);
  const [loading, setLoading] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // sync URL state
  useEffect(() => {
    const next = new URLSearchParams();
    next.set("kind", kind);
    if (contactId) next.set("contact", contactId);
    next.set("from", from);
    next.set("to", to);
    setParams(next, { replace: true });
  }, [kind, contactId, from, to, setParams]);

  // load profile + contacts
  useEffect(() => {
    if (!companyId) return;
    (async () => {
      const { data: cRes } = await supabase.from("contacts")
        .select("id, name, type, email, phone, address, opening_balance")
        .eq("company_id", companyId).eq("is_active", true).order("name");
      setProfile({ business_name: activeCompany?.name ?? "My Business", base_currency: activeCompany?.base_currency ?? "USD" });
      setContacts((cRes ?? []) as Contact[]);
    })();
  }, [companyId, activeCompany]);

  // filtered contacts for the picker (customer/supplier/both)
  const filteredContacts = useMemo(
    () => contacts.filter((c) => c.type === kind || c.type === "both"),
    [contacts, kind]
  );

  // when kind changes, drop contact if it doesn't match
  useEffect(() => {
    if (!contactId) return;
    const c = contacts.find((x) => x.id === contactId);
    if (c && c.type !== kind && c.type !== "both") setContactId("");
  }, [kind, contacts, contactId]);

  // load statement data
  useEffect(() => {
    if (!contactId) { setRows([]); setOpening(0); setCredit(0); setContact(null); return; }
    (async () => {
      setLoading(true);
      const c = contacts.find((x) => x.id === contactId) ?? null;
      setContact(c);

      const direction = kind === "customer" ? "in" : "out";

      // Available credit = total payments received/made for this contact in this direction,
      // minus everything already allocated to invoices/bills. Excess sits as on-account credit.
      const { data: payAll } = await supabase
        .from("payments")
        .select("id, amount")
        .eq("contact_id", contactId)
        .eq("direction", direction);
      const payIds = (payAll ?? []).map((p) => p.id);
      let totalAllocated = 0;
      if (payIds.length > 0) {
        const { data: allocs } = await supabase
          .from("payment_allocations")
          .select("amount")
          .in("payment_id", payIds);
        totalAllocated = (allocs ?? []).reduce((s, a) => s + Number(a.amount), 0);
      }
      const totalReceived = (payAll ?? []).reduce((s, p) => s + Number(p.amount), 0);
      setCredit(Math.max(0, totalReceived - totalAllocated));

      if (kind === "customer") {
        const [invRes, payRes] = await Promise.all([
          supabase.from("invoices").select("id, invoice_number, invoice_date, due_date, total, notes, status").eq("contact_id", contactId).neq("status", "draft").lte("invoice_date", to).order("invoice_date"),
          supabase.from("payments").select("id, payment_date, amount, reference, notes, mode, invoice_id").eq("contact_id", contactId).eq("direction", direction).lte("payment_date", to).order("payment_date"),
        ]);
        if (invRes.error || payRes.error) { toast.error((invRes.error ?? payRes.error)?.message ?? "Failed to load"); setLoading(false); return; }

        const all: Row[] = [];
        (invRes.data ?? []).forEach((i: any) => all.push({
          date: i.invoice_date, due: i.due_date ?? null, type: "Invoice", ref: `#${i.invoice_number}`,
          notes: i.notes ?? "", link: `/invoices/${i.id}`,
          debit: Number(i.total), credit: 0,
        }));
        (payRes.data ?? []).forEach((p: any) => all.push({
          date: p.payment_date, due: null, type: "Receipt",
          ref: p.reference ?? `${p.mode}`,
          notes: p.notes ?? "", link: `/payments`,
          debit: 0, credit: Number(p.amount),
        }));
        finalize(all, c?.opening_balance ?? 0);
      } else {
        const [bRes, payRes] = await Promise.all([
          supabase.from("bills").select("id, bill_number, bill_date, due_date, total, notes, status").eq("contact_id", contactId).neq("status", "draft").lte("bill_date", to).order("bill_date"),
          supabase.from("payments").select("id, payment_date, amount, reference, notes, mode, bill_id").eq("contact_id", contactId).eq("direction", direction).lte("payment_date", to).order("payment_date"),
        ]);
        if (bRes.error || payRes.error) { toast.error((bRes.error ?? payRes.error)?.message ?? "Failed to load"); setLoading(false); return; }

        const all: Row[] = [];
        (bRes.data ?? []).forEach((b: any) => all.push({
          date: b.bill_date, due: b.due_date ?? null, type: "Bill", ref: `#${b.bill_number}`,
          notes: b.notes ?? "", link: `/bills/${b.id}`,
          debit: Number(b.total), credit: 0,
        }));
        (payRes.data ?? []).forEach((p: any) => all.push({
          date: p.payment_date, due: null, type: "Payment",
          ref: p.reference ?? `${p.mode}`,
          notes: p.notes ?? "", link: `/payments`,
          debit: 0, credit: Number(p.amount),
        }));
        finalize(all, c?.opening_balance ?? 0);
      }

      setLoading(false);
    })();

    function finalize(all: Row[], openingBalance: number) {
      all.sort((a, b) => a.date.localeCompare(b.date));
      // opening = openingBalance + everything strictly before `from`
      let op = Number(openingBalance) || 0;
      const inPeriod: Row[] = [];
      all.forEach((r) => {
        if (r.date < from) op += r.debit - r.credit;
        else inPeriod.push(r);
      });
      setOpening(op);
      setRows(inPeriod);
    }
  }, [contactId, kind, from, to, contacts, reloadKey]);

  const { totalDebit, totalCredit, closing } = useMemo(() => {
    let td = 0, tc = 0;
    rows.forEach((r) => { td += r.debit; tc += r.credit; });
    return { totalDebit: td, totalCredit: tc, closing: opening + td - tc };
  }, [rows, opening]);

  const currency = profile?.base_currency || "USD";
  const debitLabel = kind === "customer" ? "Charges" : "Bills";
  const creditLabel = kind === "customer" ? "Receipts" : "Payments";

  const exportCSV = () => {
    if (!contact) return;
    const out: string[][] = [["Date", "Due Date", "Type", "Reference", "Notes", debitLabel, creditLabel, "Balance"]];
    let bal = opening;
    out.push(["", "", "", "", "Opening balance", "", "", bal.toFixed(2)]);
    rows.forEach((r) => {
      bal += r.debit - r.credit;
      out.push([r.date, r.due ?? "", r.type, r.ref, r.notes, r.debit.toFixed(2), r.credit.toFixed(2), bal.toFixed(2)]);
    });
    out.push(["", "", "", "", "Closing balance", totalDebit.toFixed(2), totalCredit.toFixed(2), closing.toFixed(2)]);
    const csv = out.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `statement-${contact.name.replace(/\s+/g, "-")}-${from}-to-${to}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const openPrint = () => {
    if (!contactId) { toast.error("Pick a contact first"); return; }
    const q = new URLSearchParams({ kind, contact: contactId, from, to }).toString();
    navigate(`/reports/statements/print?${q}`);
  };

  // running rows for display
  const displayRows = useMemo(() => {
    let bal = opening;
    return rows.map((r) => {
      bal += r.debit - r.credit;
      return { ...r, balance: bal };
    });
  }, [rows, opening]);

  return (
    <>
      <PageHeader
        title="Customer & Supplier Statements"
        description="Itemised account history with a running balance"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={exportCSV} disabled={!contactId}>
              <Download className="h-4 w-4 mr-2" />Export CSV
            </Button>
            <Button size="sm" onClick={openPrint} disabled={!contactId}>
              <Printer className="h-4 w-4 mr-2" />Print / PDF
            </Button>
          </>
        }
      />
      <div className="p-6 space-y-4">
        <Card className="shadow-[var(--shadow-card)]">
          <CardContent className="p-5 grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as Kind)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer">Customer</SelectItem>
                  <SelectItem value="supplier">Supplier</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Contact</Label>
              <Select value={contactId} onValueChange={setContactId}>
                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  {filteredContacts.length === 0 ? (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">No {kind}s</div>
                  ) : filteredContacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
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

        {contactId && (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
            <Card className="shadow-[var(--shadow-card)]"><CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Opening</p>
              <p className="text-lg font-semibold num">{formatMoney(opening, currency)}</p>
            </CardContent></Card>
            <Card className="shadow-[var(--shadow-card)]"><CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{debitLabel}</p>
              <p className="text-lg font-semibold num">{formatMoney(totalDebit, currency)}</p>
            </CardContent></Card>
            <Card className="shadow-[var(--shadow-card)]"><CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{creditLabel}</p>
              <p className="text-lg font-semibold num">{formatMoney(totalCredit, currency)}</p>
            </CardContent></Card>
            <Card className="shadow-[var(--shadow-card)]"><CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Available credit</p>
              <p className={cn("text-lg font-semibold num", credit > 0 ? "text-success" : "")}>{formatMoney(credit, currency)}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {credit > 0
                  ? (kind === "customer" ? "Unallocated receipts" : "Unallocated payments")
                  : "No on-account credit"}
              </p>
              {credit > 0 && (
                <Button size="sm" variant="outline" className="mt-2 h-7 text-xs" onClick={() => setApplyOpen(true)}>
                  Apply credit
                </Button>
              )}
            </CardContent></Card>
            <Card className="shadow-[var(--shadow-card)]"><CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Closing balance</p>
              <p className={cn("text-xl font-bold num", closing < 0 ? "text-success" : closing > 0 ? "text-primary" : "")}>{formatMoney(closing, currency)}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {closing > 0 ? (kind === "customer" ? "Owed to you" : "You owe") : closing < 0 ? "Credit balance" : "Settled"}
              </p>
            </CardContent></Card>
          </div>
        )}

        <Card className="shadow-[var(--shadow-card)]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Date</TableHead>
                <TableHead className="w-28">Due Date</TableHead>
                <TableHead className="w-28">Type</TableHead>
                <TableHead className="w-40">Reference</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="text-right w-32">{debitLabel}</TableHead>
                <TableHead className="text-right w-32">{creditLabel}</TableHead>
                <TableHead className="text-right w-32">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!contactId ? (
                <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-10">Pick a contact to see their statement.</TableCell></TableRow>
              ) : loading ? (
                <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-10">Loading…</TableCell></TableRow>
              ) : (
                <>
                  <TableRow className="bg-muted/30 font-medium">
                    <TableCell colSpan={7} className="text-sm">Opening balance as of {from}</TableCell>
                    <TableCell className="text-right num">{formatMoney(opening, currency)}</TableCell>
                  </TableRow>
                  {displayRows.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-6 italic">No transactions in this period.</TableCell></TableRow>
                  ) : displayRows.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="num text-sm">{formatDate(r.date)}</TableCell>
                      <TableCell className="num text-sm text-muted-foreground">{r.due ? formatDate(r.due) : "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-normal">{r.type}</Badge>
                      </TableCell>
                      <TableCell className="num text-sm">
                        {r.link ? (
                          <button className="text-primary hover:underline" onClick={() => navigate(r.link!)}>{r.ref}</button>
                        ) : r.ref}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground truncate max-w-xs">{r.notes}</TableCell>
                      <TableCell className="text-right num">{r.debit ? formatMoney(r.debit, currency) : "—"}</TableCell>
                      <TableCell className="text-right num">{r.credit ? formatMoney(r.credit, currency) : "—"}</TableCell>
                      <TableCell className="text-right num font-medium">{formatMoney(r.balance, currency)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-primary/10 font-bold border-t-2">
                    <TableCell colSpan={5}>Closing balance as of {to}</TableCell>
                    <TableCell className="text-right num">{formatMoney(totalDebit, currency)}</TableCell>
                    <TableCell className="text-right num">{formatMoney(totalCredit, currency)}</TableCell>
                    <TableCell className="text-right num">{formatMoney(closing, currency)}</TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
      {contactId && contact && (
        <ApplyCreditDialog
          open={applyOpen}
          onOpenChange={setApplyOpen}
          kind={kind}
          contactId={contactId}
          availableCredit={credit}
          currency={currency}
          onApplied={() => setReloadKey((k) => k + 1)}
        />
      )}
    </>
  );
};

export default ContactStatement;
