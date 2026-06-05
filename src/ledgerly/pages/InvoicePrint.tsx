import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, Download } from "lucide-react";
import { toast } from "sonner";
import { formatMoney, formatNumber, formatDate } from "@/lib/format";
import { downloadElementAsPdf } from "@/lib/pdf";

interface Profile { business_name: string; base_currency: string; logo_url: string | null; address: string | null; email: string | null; phone: string | null; website: string | null; tax_number: string | null; invoice_footer: string | null; }
interface Contact { name: string; email: string | null; phone: string | null; address: string | null; }
interface Invoice {
  id: string; invoice_number: string; invoice_date: string; due_date: string | null;
  subtotal: number; tax_amount: number; tax_percent: number; total: number; paid_amount: number;
  status: string; notes: string | null;
}
interface InvoiceLine {
  id: string; description: string | null; quantity: number; rate: number; amount: number;
  item: { name: string; sku: string | null; unit: string } | null;
}

const InvoicePrint = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [contact, setContact] = useState<Contact | null>(null);
  const [lines, setLines] = useState<InvoiceLine[]>([]);
  const [loading, setLoading] = useState(true);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (!sheetRef.current || !invoice) return;
    setDownloading(true);
    try {
      await downloadElementAsPdf(sheetRef.current, `invoice-${invoice.invoice_number}.pdf`);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to generate PDF");
    } finally {
      setDownloading(false);
    }
  };

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const [{ data: u }] = await Promise.all([supabase.auth.getUser()]);
      const userId = u.user?.id;

      const [pRes, iRes, lRes] = await Promise.all([
        userId ? supabase.from("profiles").select("business_name, base_currency, logo_url, address, email, phone, website, tax_number, invoice_footer").eq("user_id", userId).single() : Promise.resolve({ data: null, error: null } as any),
        supabase.from("invoices").select("*, contact:contacts(name, email, phone, address)").eq("id", id).single(),
        supabase.from("invoice_lines").select("id, description, quantity, rate, amount, item:items(name, sku, unit)").eq("invoice_id", id).order("created_at"),
      ]);
      if (iRes.error || !iRes.data) { toast.error(iRes.error?.message ?? "Invoice not found"); setLoading(false); return; }
      setProfile((pRes as any).data ?? { business_name: "My Business", base_currency: "USD", logo_url: null, address: null, email: null, phone: null, website: null, tax_number: null, invoice_footer: null });
      const inv = iRes.data as any;
      setInvoice(inv);
      setContact(inv.contact ?? null);
      setLines((lRes.data ?? []) as unknown as InvoiceLine[]);
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <div className="p-10 text-center text-sm text-muted-foreground">Loading…</div>;
  if (!invoice) return <div className="p-10 text-center text-sm text-muted-foreground">Not found.</div>;

  const currency = profile?.base_currency || "USD";
  const balance = Number(invoice.total) - Number(invoice.paid_amount);

  return (
    <div className="min-h-screen bg-muted/30 print:bg-white">
      {/* Toolbar - hidden on print */}
      <div className="print:hidden border-b bg-card">
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => navigate(`/invoices/${invoice.id}`)}>
            <ArrowLeft className="h-4 w-4 mr-2" />Back to invoice
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleDownload} disabled={downloading}>
              <Download className="h-4 w-4 mr-2" />{downloading ? "Generating…" : "Download PDF"}
            </Button>
            <Button size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4 mr-2" />Print
            </Button>
          </div>
        </div>
      </div>

      {/* Document */}
      <div className="max-w-4xl mx-auto p-6 print:p-0 print:max-w-none">
        <div ref={sheetRef} className="bg-card text-card-foreground shadow-sm print:shadow-none p-10 print:p-0 invoice-sheet">
          {/* Header */}
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
              <h2 className="text-3xl font-bold uppercase tracking-tight text-primary">Invoice</h2>
              <p className="text-sm font-medium mt-1 num">#{invoice.invoice_number}</p>
              <p className="text-xs text-muted-foreground mt-2 capitalize">Status: {invoice.status}</p>
            </div>
          </div>

          {/* Bill to + dates */}
          <div className="grid grid-cols-2 gap-8 mb-10">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Bill to</p>
              <p className="font-semibold text-base">{contact?.name ?? "—"}</p>
              {contact?.address && <p className="text-sm text-muted-foreground whitespace-pre-line mt-1">{contact.address}</p>}
              {contact?.email && <p className="text-sm text-muted-foreground mt-1">{contact.email}</p>}
              {contact?.phone && <p className="text-sm text-muted-foreground">{contact.phone}</p>}
            </div>
            <div className="text-right space-y-2">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Invoice date</p>
                <p className="text-sm font-medium">{formatDate(invoice.invoice_date)}</p>
              </div>
              {invoice.due_date && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Due date</p>
                  <p className="text-sm font-medium">{formatDate(invoice.due_date)}</p>
                </div>
              )}
            </div>
          </div>

          {/* Lines */}
          <table className="w-full text-sm border-collapse mb-8">
            <thead>
              <tr className="border-b-2 border-foreground/80">
                <th className="text-left py-2 pr-3 text-[11px] uppercase tracking-wider font-semibold w-10">#</th>
                <th className="text-left py-2 pr-3 text-[11px] uppercase tracking-wider font-semibold">Description</th>
                <th className="text-right py-2 px-3 text-[11px] uppercase tracking-wider font-semibold w-20">Qty</th>
                <th className="text-right py-2 px-3 text-[11px] uppercase tracking-wider font-semibold w-28">Rate</th>
                <th className="text-right py-2 pl-3 text-[11px] uppercase tracking-wider font-semibold w-32">Amount</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={l.id} className="border-b border-border/60">
                  <td className="py-3 pr-3 text-muted-foreground num align-top">{i + 1}</td>
                  <td className="py-3 pr-3 align-top">
                    <p className="font-medium">{l.item?.name ?? l.description ?? "Item"}</p>
                    {l.item?.sku && <p className="text-xs text-muted-foreground">SKU: {l.item.sku}</p>}
                    {l.description && l.item && <p className="text-xs text-muted-foreground mt-0.5">{l.description}</p>}
                  </td>
                  <td className="py-3 px-3 text-right num align-top">{formatNumber(l.quantity, 2)} {l.item?.unit ?? ""}</td>
                  <td className="py-3 px-3 text-right num align-top">{formatMoney(l.rate, currency)}</td>
                  <td className="py-3 pl-3 text-right num font-medium align-top">{formatMoney(l.amount, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="flex justify-end mb-10">
            <div className="w-72 space-y-2 text-sm">
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="num font-medium">{formatMoney(invoice.subtotal, currency)}</span>
              </div>
              {Number(invoice.tax_amount) > 0 && (
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Tax ({formatNumber(invoice.tax_percent, 2)}%)</span>
                  <span className="num font-medium">{formatMoney(invoice.tax_amount, currency)}</span>
                </div>
              )}
              <div className="flex justify-between py-2 border-t-2 border-foreground/80 text-base font-bold">
                <span>Total</span>
                <span className="num">{formatMoney(invoice.total, currency)}</span>
              </div>
              {Number(invoice.paid_amount) > 0 && (
                <>
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">Paid</span>
                    <span className="num font-medium">{formatMoney(invoice.paid_amount, currency)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-t border-border bg-primary/5 px-2 -mx-2 rounded font-semibold">
                    <span>Balance due</span>
                    <span className="num">{formatMoney(balance, currency)}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Notes */}
          {invoice.notes && (
            <div className="border-t pt-4 mb-8">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Notes</p>
              <p className="text-sm text-muted-foreground whitespace-pre-line">{invoice.notes}</p>
            </div>
          )}

          {/* Footer */}
          <div className="border-t pt-4 text-center text-xs text-muted-foreground">
            <p>{profile?.invoice_footer ?? "Thank you for your business."}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoicePrint;
