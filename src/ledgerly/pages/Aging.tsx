import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Printer } from "lucide-react";
import { toast } from "sonner";
import { formatMoney, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useCompany } from "@/contexts/CompanyContext";

type Kind = "ar" | "ap";

interface Doc {
  id: string;
  number: string;
  doc_date: string;
  due_date: string | null;
  total: number;
  paid_amount: number;
  status: string;
  contact_id: string;
  contact_name: string;
}

interface ContactRow {
  contact_id: string;
  contact_name: string;
  total: number;
  docs: Doc[];
}

const todayISO = () => new Date().toISOString().slice(0, 10);

const daysOverdue = (asOf: string, dueDate: string | null, docDate: string) => {
  const ref = dueDate ?? docDate;
  const a = new Date(asOf).getTime();
  const d = new Date(ref).getTime();
  return Math.floor((a - d) / (1000 * 60 * 60 * 24));
};

const bucketOf = (asOf: string, dueDate: string | null, docDate: string) => {
  const days = daysOverdue(asOf, dueDate, docDate);
  if (days <= 0) return "current" as const;
  if (days <= 30) return "b30" as const;
  if (days <= 60) return "b60" as const;
  if (days <= 90) return "b90" as const;
  return "b90plus" as const;
};

const FragmentRows = ({ r, asOf, linkBase }: { r: ContactRow; asOf: string; linkBase: string }) => (
  <>
    <TableRow className="bg-muted/30 font-semibold">
      <TableCell className="break-words whitespace-normal" colSpan={2}>{r.contact_name}</TableCell>
      <TableCell />
      <TableCell className="text-right num whitespace-nowrap">{formatMoney(r.total)}</TableCell>
    </TableRow>
    {r.docs.map((d) => {
      const bal = d.total - d.paid_amount;
      const days = daysOverdue(asOf, d.due_date, d.doc_date);
      return (
        <TableRow key={d.id} className="text-sm">
          <TableCell className="pl-8 break-words whitespace-normal">
            <Link to={`${linkBase}/${d.id}`} className="text-primary hover:underline">{d.number}</Link>
            <Badge variant="outline" className="ml-2 text-[10px] capitalize">{d.status}</Badge>
          </TableCell>
          <TableCell className="text-muted-foreground whitespace-nowrap">{formatDate(d.due_date ?? d.doc_date)}</TableCell>
          <TableCell className={cn("text-right whitespace-nowrap num", days > 90 && "text-destructive", days > 30 && days <= 90 && "text-warning")}>
            {days <= 0 ? "Current" : `${days} days`}
          </TableCell>
          <TableCell className="text-right num whitespace-nowrap">{formatMoney(bal)}</TableCell>
        </TableRow>
      );
    })}
  </>
);

const Aging = ({ kind }: { kind: Kind }) => {
  const navigate = useNavigate();
  const { companyId } = useCompany();
  const [asOf, setAsOf] = useState(todayISO());
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(false);
  const [contacts, setContacts] = useState<{ id: string; name: string }[]>([]);
  const [contactId, setContactId] = useState<string>("all");

  const config = kind === "ar"
    ? { title: "Accounts Receivable Aging", desc: "Open invoices grouped by customer with days overdue", table: "invoices" as const, numberCol: "invoice_number", dateCol: "invoice_date", linkBase: "/invoices", contactTypes: ["customer", "both"] as const }
    : { title: "Accounts Payable Aging", desc: "Open bills grouped by supplier with days overdue", table: "bills" as const, numberCol: "bill_number", dateCol: "bill_date", linkBase: "/bills", contactTypes: ["supplier", "both"] as const };

  // Reset contact filter when switching AR/AP
  useEffect(() => { setContactId("all"); }, [kind]);

  // Load contacts list for the filter
  useEffect(() => {
    if (!companyId) return;
    (async () => {
      const { data } = await supabase
        .from("contacts")
        .select("id, name, type")
        .eq("company_id", companyId)
        .eq("is_active", true)
        .in("type", config.contactTypes as readonly ("customer" | "supplier" | "both")[])
        .order("name");
      setContacts((data ?? []).map((c) => ({ id: c.id, name: c.name })));
    })();
  }, [kind, companyId]);

  useEffect(() => {
    if (!companyId) return;
    (async () => {
      setLoading(true);
      let q = supabase
        .from(config.table)
        .select(`id, ${config.numberCol}, ${config.dateCol}, due_date, total, paid_amount, status, contact_id, contact:contacts(name)`)
        .eq("company_id", companyId)
        .in("status", ["open", "partial"])
        .lte(config.dateCol, asOf);
      if (contactId !== "all") q = q.eq("contact_id", contactId);
      const { data, error } = await q;
      if (error) { toast.error(error.message); setLoading(false); return; }
      setDocs((data ?? []).map((d: any) => ({
        id: d.id,
        number: d[config.numberCol],
        doc_date: d[config.dateCol],
        due_date: d.due_date,
        total: Number(d.total),
        paid_amount: Number(d.paid_amount),
        status: d.status,
        contact_id: d.contact_id,
        contact_name: d.contact?.name ?? "—",
      })));
      setLoading(false);
    })();
  }, [asOf, kind, contactId, companyId]);

  const { rows, totals } = useMemo(() => {
    const byContact = new Map<string, ContactRow>();
    const bucketTotals = { current: 0, b30: 0, b60: 0, b90: 0, b90plus: 0, total: 0 };
    for (const d of docs) {
      const balance = d.total - d.paid_amount;
      if (balance <= 0.005) continue;
      const b = bucketOf(asOf, d.due_date, d.doc_date);
      bucketTotals[b] += balance;
      bucketTotals.total += balance;
      const cur = byContact.get(d.contact_id) ?? {
        contact_id: d.contact_id, contact_name: d.contact_name,
        total: 0, docs: [],
      };
      cur.total += balance;
      cur.docs.push(d);
      byContact.set(d.contact_id, cur);
    }
    const rows = Array.from(byContact.values()).sort((a, b) => b.total - a.total);
    return { rows, totals: bucketTotals };
  }, [docs, asOf]);

  const exportCSV = () => {
    const header = ["Contact", "Document", "Due Date", "Days", "Balance"];
    const lines: string[][] = [];
    for (const r of rows) {
      for (const d of r.docs) {
        const bal = d.total - d.paid_amount;
        const days = daysOverdue(asOf, d.due_date, d.doc_date);
        lines.push([r.contact_name, d.number, formatDate(d.due_date ?? d.doc_date), days <= 0 ? "Current" : String(days), bal.toFixed(2)]);
      }
    }
    const csv = [header, ...lines].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${kind}-aging-${asOf}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const KpiCard = ({ label, value, tone }: { label: string; value: number; tone?: "warn" | "danger" }) => (
    <Card className="shadow-[var(--shadow-card)]"><CardContent className="p-3 min-w-0">
      <p className="text-xs text-muted-foreground truncate">{label}</p>
      <p className={cn("text-sm md:text-base font-semibold num truncate",
        tone === "danger" && value > 0 && "text-destructive",
        tone === "warn" && value > 0 && "text-warning"
      )} title={formatMoney(value)}>{formatMoney(value)}</p>
    </CardContent></Card>
  );

  return (
    <>
      <PageHeader
        title={config.title}
        description={config.desc}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => {
              const q = new URLSearchParams({ kind, asOf, contact: contactId }).toString();
              navigate(`/reports/aging/print?${q}`);
            }} disabled={rows.length === 0}>
              <Printer className="h-4 w-4 mr-2" />Print / PDF
            </Button>
            <Button variant="outline" size="sm" onClick={exportCSV} disabled={rows.length === 0}>
              <Download className="h-4 w-4 mr-2" />Export CSV
            </Button>
          </div>
        }
      />
      <div className="p-6 space-y-4">
        <Card className="shadow-[var(--shadow-card)]">
          <CardContent className="p-5 grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label>As of</Label>
              <Input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>{kind === "ar" ? "Customer" : "Supplier"}</Label>
              <Select value={contactId} onValueChange={setContactId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All {kind === "ar" ? "customers" : "suppliers"}</SelectItem>
                  {contacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          <KpiCard label="Total outstanding" value={totals.total} />
          <KpiCard label="Current" value={totals.current} />
          <KpiCard label="1-30 days" value={totals.b30} />
          <KpiCard label="31-60 days" value={totals.b60} tone="warn" />
          <KpiCard label="61-90 days" value={totals.b90} tone="warn" />
          <KpiCard label="90+ days" value={totals.b90plus} tone="danger" />
        </div>

        <Card className="shadow-[var(--shadow-card)] overflow-x-auto">
          <Table className="min-w-[700px]">
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[200px]">{kind === "ar" ? "Customer" : "Supplier"} / Document</TableHead>
                <TableHead className="w-28 whitespace-nowrap">Due date</TableHead>
                <TableHead className="text-right w-28 whitespace-nowrap">Days</TableHead>
                <TableHead className="text-right w-36 whitespace-nowrap">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-10">Loading…</TableCell></TableRow>
              )}
              {!loading && rows.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-10">No outstanding {kind === "ar" ? "invoices" : "bills"} as of {asOf}.</TableCell></TableRow>
              )}
              {rows.map((r) => (
                <FragmentRows key={r.contact_id} r={r} asOf={asOf} linkBase={config.linkBase} />
              ))}
              {rows.length > 0 && (
                <TableRow className="bg-primary/10 font-bold border-t-2">
                  <TableCell colSpan={3}>TOTAL</TableCell>
                  <TableCell className="text-right num whitespace-nowrap">{formatMoney(totals.total)}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </>
  );
};

export default Aging;
