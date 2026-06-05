import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/ledgerly/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { formatMoney, formatDate } from "@/ledgerly/lib/format";

type Kind = "customer" | "supplier";
interface Contact { id: string; name: string; email: string | null; phone: string | null; address: string | null; opening_balance: number; type: string; }
interface Profile { business_name: string; base_currency: string; logo_url: string | null; address: string | null; email: string | null; phone: string | null; website: string | null; tax_number: string | null; invoice_footer: string | null; }
interface Row { date: string; due: string | null; type: string; ref: string; notes: string; debit: number; credit: number; }

const ContactStatementPrint = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const kind = (params.get("kind") as Kind) || "customer";
  const contactId = params.get("contact") || "";
  const from = params.get("from") || "";
  const to = params.get("to") || "";

  const [profile, setProfile] = useState<Profile | null>(null);
  const [contact, setContact] = useState<Contact | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [opening, setOpening] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!contactId || !from || !to) { setLoading(false); return; }
    (async () => {
      setLoading(true);
      const { data: u } = await supabase.auth.getUser();
      const userId = u.user?.id;
      const [pRes, cRes] = await Promise.all([
        userId ? supabase.from("profiles").select("business_name, base_currency, logo_url, address, email, phone, website, tax_number, invoice_footer").eq("user_id", userId).single() : Promise.resolve({ data: null } as any),
        supabase.from("contacts").select("id, name, type, email, phone, address, opening_balance").eq("id", contactId).single(),
      ]);
      setProfile(pRes.data ?? { business_name: "My Business", base_currency: "USD", logo_url: null, address: null, email: null, phone: null, website: null, tax_number: null, invoice_footer: null });
      if (cRes.error || !cRes.data) { toast.error("Contact not found"); setLoading(false); return; }
      setContact(cRes.data as Contact);

      const direction = kind === "customer" ? "in" : "out";
      const all: Row[] = [];

      if (kind === "customer") {
        const [invRes, payRes] = await Promise.all([
          supabase.from("invoices").select("invoice_number, invoice_date, due_date, total, notes, status").eq("contact_id", contactId).neq("status", "draft").lte("invoice_date", to).order("invoice_date"),
          supabase.from("payments").select("payment_date, amount, reference, notes, mode").eq("contact_id", contactId).eq("direction", direction).lte("payment_date", to).order("payment_date"),
        ]);
        (invRes.data ?? []).forEach((i: any) => all.push({ date: i.invoice_date, due: i.due_date ?? null, type: "Invoice", ref: `#${i.invoice_number}`, notes: i.notes ?? "", debit: Number(i.total), credit: 0 }));
        (payRes.data ?? []).forEach((p: any) => all.push({ date: p.payment_date, due: null, type: "Receipt", ref: p.reference ?? p.mode, notes: p.notes ?? "", debit: 0, credit: Number(p.amount) }));
      } else {
        const [bRes, payRes] = await Promise.all([
          supabase.from("bills").select("bill_number, bill_date, due_date, total, notes, status").eq("contact_id", contactId).neq("status", "draft").lte("bill_date", to).order("bill_date"),
          supabase.from("payments").select("payment_date, amount, reference, notes, mode").eq("contact_id", contactId).eq("direction", direction).lte("payment_date", to).order("payment_date"),
        ]);
        (bRes.data ?? []).forEach((b: any) => all.push({ date: b.bill_date, due: b.due_date ?? null, type: "Bill", ref: `#${b.bill_number}`, notes: b.notes ?? "", debit: Number(b.total), credit: 0 }));
        (payRes.data ?? []).forEach((p: any) => all.push({ date: p.payment_date, due: null, type: "Payment", ref: p.reference ?? p.mode, notes: p.notes ?? "", debit: 0, credit: Number(p.amount) }));
      }

      all.sort((a, b) => a.date.localeCompare(b.date));
      let op = Number(cRes.data.opening_balance) || 0;
      const inPeriod: Row[] = [];
      all.forEach((r) => { if (r.date < from) op += r.debit - r.credit; else inPeriod.push(r); });
      setOpening(op);
      setRows(inPeriod);
      setLoading(false);
    })();
  }, [contactId, kind, from, to]);

  const { totalDebit, totalCredit, closing, displayRows } = useMemo(() => {
    let bal = opening, td = 0, tc = 0;
    const display = rows.map((r) => { bal += r.debit - r.credit; td += r.debit; tc += r.credit; return { ...r, balance: bal }; });
    return { totalDebit: td, totalCredit: tc, closing: opening + td - tc, displayRows: display };
  }, [rows, opening]);

  if (loading) return <div className="p-10 text-center text-sm text-muted-foreground">Loading…</div>;
  if (!contact) return <div className="p-10 text-center text-sm text-muted-foreground">Contact not found.</div>;

  const currency = profile?.base_currency || "USD";
  const debitLabel = kind === "customer" ? "Charges" : "Bills";
  const creditLabel = kind === "customer" ? "Receipts" : "Payments";

  return (
    <div className="min-h-screen bg-muted/30 print:bg-white">
      <div className="print:hidden border-b bg-card">
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />Back
          </Button>
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-2" />Print / Save as PDF
          </Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6 print:p-0 print:max-w-none">
        <div className="bg-card text-card-foreground shadow-sm print:shadow-none p-10 print:p-0 invoice-sheet">
          <div className="flex items-start justify-between mb-10 gap-6">
            <div className="flex items-start gap-4 min-w-0">
              {profile?.logo_url && (
                <img src={profile.logo_url} alt="Logo" className="h-16 w-16 object-contain shrink-0" />
              )}
              <div className="min-w-0">
                <h1 className="text-2xl font-bold tracking-tight">{profile?.business_name ?? "My Business"}</h1>
                {profile?.address && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-line">{profile.address}</p>}
                <div className="text-xs text-muted-foreground mt-1 space-x-2">
                  {profile?.email && <span>{profile.email}</span>}
                  {profile?.phone && <span>· {profile.phone}</span>}
                  {profile?.website && <span>· {profile.website}</span>}
                </div>
                {profile?.tax_number && <p className="text-xs text-muted-foreground mt-0.5">Tax #: {profile.tax_number}</p>}
              </div>
            </div>
            <div className="text-right shrink-0">
              <h2 className="text-3xl font-bold uppercase tracking-tight text-primary">Statement</h2>
              <p className="text-xs text-muted-foreground mt-2">Period: {from} — {to}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 mb-8">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                {kind === "customer" ? "Statement to" : "Statement from"}
              </p>
              <p className="font-semibold text-base">{contact.name}</p>
              {contact.address && <p className="text-sm text-muted-foreground whitespace-pre-line mt-1">{contact.address}</p>}
              {contact.email && <p className="text-sm text-muted-foreground mt-1">{contact.email}</p>}
              {contact.phone && <p className="text-sm text-muted-foreground">{contact.phone}</p>}
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Closing balance</p>
              <p className="text-2xl font-bold num text-primary mt-1">{formatMoney(closing, currency)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {closing > 0 ? (kind === "customer" ? "Amount due from customer" : "Amount due to supplier") : closing < 0 ? "Credit balance" : "Settled"}
              </p>
            </div>
          </div>

          <table className="w-full text-sm border-collapse mb-6">
            <thead>
              <tr className="border-b-2 border-foreground/80">
                <th className="text-left py-2 pr-3 text-[11px] uppercase tracking-wider font-semibold w-24">Date</th>
                <th className="text-left py-2 pr-3 text-[11px] uppercase tracking-wider font-semibold w-24">Due</th>
                <th className="text-left py-2 pr-3 text-[11px] uppercase tracking-wider font-semibold w-20">Type</th>
                <th className="text-left py-2 pr-3 text-[11px] uppercase tracking-wider font-semibold">Reference</th>
                <th className="text-right py-2 px-3 text-[11px] uppercase tracking-wider font-semibold w-24">{debitLabel}</th>
                <th className="text-right py-2 px-3 text-[11px] uppercase tracking-wider font-semibold w-24">{creditLabel}</th>
                <th className="text-right py-2 pl-3 text-[11px] uppercase tracking-wider font-semibold w-28">Balance</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border/60 bg-muted/20">
                <td className="py-2 pr-3 num text-xs">{from}</td>
                <td className="py-2 pr-3 text-xs italic" colSpan={3}>Opening balance</td>
                <td className="py-2 px-3"></td>
                <td className="py-2 px-3"></td>
                <td className="py-2 pl-3 text-right num font-medium">{formatMoney(opening, currency)}</td>
              </tr>
              {displayRows.length === 0 ? (
                <tr><td colSpan={7} className="py-6 text-center text-muted-foreground italic text-xs">No transactions in this period.</td></tr>
              ) : displayRows.map((r, i) => (
                <tr key={i} className="border-b border-border/60">
                  <td className="py-2 pr-3 num text-xs align-top">{formatDate(r.date)}</td>
                  <td className="py-2 pr-3 num text-xs align-top text-muted-foreground">{r.due ? formatDate(r.due) : ""}</td>
                  <td className="py-2 pr-3 text-xs align-top">{r.type}</td>
                  <td className="py-2 pr-3 text-xs align-top">
                    <span className="num">{r.ref}</span>
                    {r.notes && <p className="text-xs text-muted-foreground mt-0.5">{r.notes}</p>}
                  </td>
                  <td className="py-2 px-3 text-right num text-xs align-top">{r.debit ? formatMoney(r.debit, currency) : ""}</td>
                  <td className="py-2 px-3 text-right num text-xs align-top">{r.credit ? formatMoney(r.credit, currency) : ""}</td>
                  <td className="py-2 pl-3 text-right num text-xs font-medium align-top">{formatMoney(r.balance, currency)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-foreground/80 font-bold">
                <td className="py-3 pr-3 num text-xs">{to}</td>
                <td className="py-3 pr-3 text-xs" colSpan={3}>Closing balance</td>
                <td className="py-3 px-3 text-right num">{formatMoney(totalDebit, currency)}</td>
                <td className="py-3 px-3 text-right num">{formatMoney(totalCredit, currency)}</td>
                <td className="py-3 pl-3 text-right num">{formatMoney(closing, currency)}</td>
              </tr>
            </tbody>
          </table>

          <div className="border-t pt-4 text-center text-xs text-muted-foreground">
            <p>{profile?.invoice_footer ?? "Please remit any outstanding balance at your earliest convenience. Thank you for your business."}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactStatementPrint;
