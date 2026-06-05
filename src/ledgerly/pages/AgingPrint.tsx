import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/ledgerly/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, Download } from "lucide-react";
import { toast } from "sonner";
import { formatMoney, formatDate } from "@/ledgerly/lib/format";
import { cn } from "@/lib/utils";
import { downloadElementAsPdf } from "@/ledgerly/lib/pdf";

type Kind = "ar" | "ap";

interface Profile {
  business_name: string;
  base_currency: string;
  logo_url: string | null;
  address: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  tax_number: string | null;
  invoice_footer: string | null;
}

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

const daysOverdue = (asOf: string, dueDate: string | null, docDate: string) => {
  const ref = dueDate ?? docDate;
  const a = new Date(asOf).getTime();
  const d = new Date(ref).getTime();
  return Math.floor((a - d) / (1000 * 60 * 60 * 24));
};

const FragmentRows = ({ r, asOf, currency }: { r: ContactRow; asOf: string; currency: string }) => (
  <>
    <tr className="border-b border-border/60 bg-muted/30 font-semibold">
      <td className="py-1.5 pr-2 align-top" colSpan={2}>{r.contact_name}</td>
      <td className="py-1.5 px-2"></td>
      <td className="py-1.5 pl-2 text-right num">{formatMoney(r.total, currency)}</td>
    </tr>
    {r.docs.map((d) => {
      const bal = d.total - d.paid_amount;
      const days = daysOverdue(asOf, d.due_date, d.doc_date);
      return (
        <tr key={d.id} className="border-b border-border/40 text-[11px]">
          <td className="py-1 pr-2 pl-4 align-top">
            <span className="num">{d.number}</span>
            <span className="ml-2 text-[9px] uppercase text-muted-foreground">{d.status}</span>
          </td>
          <td className="py-1 px-2 text-muted-foreground num">{formatDate(d.due_date ?? d.doc_date)}</td>
          <td className={cn("py-1 px-2 text-right num text-muted-foreground", days > 90 && "text-destructive", days > 30 && days <= 90 && "text-warning")}>
            {days <= 0 ? "Current" : `${days} days`}
          </td>
          <td className="py-1 pl-2 text-right num">{formatMoney(bal, currency)}</td>
        </tr>
      );
    })}
  </>
);

const AgingPrint = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const kind = (params.get("kind") as Kind) || "ar";
  const asOf = params.get("asOf") || new Date().toISOString().slice(0, 10);
  const contactId = params.get("contact") || "all";

  const [profile, setProfile] = useState<Profile | null>(null);
  const [contactName, setContactName] = useState<string>("");
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  const config = kind === "ar"
    ? { title: "Accounts Receivable Aging", table: "invoices" as const, numberCol: "invoice_number", dateCol: "invoice_date", entityLabel: "Customer" }
    : { title: "Accounts Payable Aging", table: "bills" as const, numberCol: "bill_number", dateCol: "bill_date", entityLabel: "Supplier" };

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: u } = await supabase.auth.getUser();
      const userId = u.user?.id;

      const pPromise = userId
        ? supabase.from("profiles").select("business_name, base_currency, logo_url, address, email, phone, website, tax_number, invoice_footer").eq("user_id", userId).single()
        : Promise.resolve({ data: null } as any);

      let q = supabase
        .from(config.table)
        .select(`id, ${config.numberCol}, ${config.dateCol}, due_date, total, paid_amount, status, contact_id, contact:contacts(name)`)
        .in("status", ["open", "partial"])
        .lte(config.dateCol, asOf);
      if (contactId !== "all") q = q.eq("contact_id", contactId);

      const cPromise = contactId !== "all"
        ? supabase.from("contacts").select("name").eq("id", contactId).single()
        : Promise.resolve({ data: null } as any);

      const [pRes, dRes, cRes] = await Promise.all([pPromise, q, cPromise]);

      setProfile(pRes.data ?? { business_name: "My Business", base_currency: "USD", logo_url: null, address: null, email: null, phone: null, website: null, tax_number: null, invoice_footer: null });
      if (cRes?.data?.name) setContactName(cRes.data.name);

      if (dRes.error) { toast.error(dRes.error.message); setLoading(false); return; }

      setDocs((dRes.data ?? []).map((d: any) => ({
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
  }, [kind, asOf, contactId]);

  const { rows, total } = useMemo(() => {
    const byContact = new Map<string, ContactRow>();
    let grandTotal = 0;
    for (const d of docs) {
      const balance = d.total - d.paid_amount;
      if (balance <= 0.005) continue;
      grandTotal += balance;
      const cur = byContact.get(d.contact_id) ?? {
        contact_id: d.contact_id, contact_name: d.contact_name,
        total: 0, docs: [],
      };
      cur.total += balance;
      cur.docs.push(d);
      byContact.set(d.contact_id, cur);
    }
    const rows = Array.from(byContact.values()).sort((a, b) => b.total - a.total);
    return { rows, total: grandTotal };
  }, [docs]);

  const handleDownload = async () => {
    if (!sheetRef.current) return;
    setDownloading(true);
    try {
      await downloadElementAsPdf(sheetRef.current, `${kind}-aging-${asOf}.pdf`);
    } finally {
      setDownloading(false);
    }
  };

  if (loading) return <div className="p-10 text-center text-sm text-muted-foreground">Loading…</div>;

  const currency = profile?.base_currency || "USD";

  return (
    <div className="min-h-screen bg-muted/30 print:bg-white">
      <div className="print:hidden border-b bg-card">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />Back
          </Button>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4 mr-2" />Print / Save as PDF
            </Button>
            <Button size="sm" variant="outline" onClick={handleDownload} disabled={downloading}>
              <Download className="h-4 w-4 mr-2" />{downloading ? "Generating…" : "Download PDF"}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-6 print:p-0 print:max-w-none">
        <div ref={sheetRef} className="bg-card text-card-foreground shadow-sm print:shadow-none p-10 print:p-0 invoice-sheet">
          <div className="flex items-start justify-between mb-8 gap-6">
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
              <h2 className="text-2xl font-bold uppercase tracking-tight text-primary">{config.title}</h2>
              <p className="text-xs text-muted-foreground mt-2">As of {formatDate(asOf)}</p>
              {contactId !== "all" && contactName && (
                <p className="text-xs text-muted-foreground mt-0.5">{config.entityLabel}: {contactName}</p>
              )}
            </div>
          </div>

          <table className="w-full text-xs border-collapse mb-6">
            <thead>
              <tr className="border-b-2 border-foreground/80">
                <th className="text-left py-2 pr-2 text-[10px] uppercase tracking-wider font-semibold">{config.entityLabel} / Document</th>
                <th className="text-left py-2 px-2 text-[10px] uppercase tracking-wider font-semibold w-20">Due date</th>
                <th className="text-right py-2 px-2 text-[10px] uppercase tracking-wider font-semibold w-20">Days</th>
                <th className="text-right py-2 pl-2 text-[10px] uppercase tracking-wider font-semibold">Balance</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={4} className="py-6 text-center text-muted-foreground italic">No outstanding {kind === "ar" ? "invoices" : "bills"} as of {formatDate(asOf)}.</td></tr>
              ) : rows.map((r) => (
                <FragmentRows key={r.contact_id} r={r} asOf={asOf} currency={currency} />
              ))}
              {rows.length > 0 && (
                <tr className="border-t-2 border-foreground/80 font-bold">
                  <td className="py-2 pr-2" colSpan={3}>TOTAL</td>
                  <td className="py-2 pl-2 text-right num">{formatMoney(total, currency)}</td>
                </tr>
              )}
            </tbody>
          </table>

          {profile?.invoice_footer && (
            <div className="border-t pt-4 text-center text-xs text-muted-foreground">
              <p>{profile.invoice_footer}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AgingPrint;
