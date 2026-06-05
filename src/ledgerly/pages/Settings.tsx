import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Save, Upload, Trash2, Building2 } from "lucide-react";
import { fmtMoney } from "@/lib/formatProfile";
import { setFormatSettings } from "@/lib/format";

interface Profile {
  id?: string;
  user_id?: string;
  business_name: string;
  base_currency: string;
  currency_symbol: string;
  currency_position: "before" | "after";
  number_format: string;
  decimal_places: number;
  date_format: string;
  logo_url: string | null;
  address: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  tax_number: string | null;
  invoice_footer: string | null;
  invoice_prefix: string;
  invoice_next_number: number;
  invoice_pad_width: number;
  bill_prefix: string;
  bill_next_number: number;
  bill_pad_width: number;
}

const empty: Profile = {
  business_name: "My Business",
  base_currency: "USD",
  currency_symbol: "$",
  currency_position: "before",
  number_format: "en-US",
  decimal_places: 2,
  date_format: "yyyy-MM-dd",
  logo_url: null,
  address: null,
  email: null,
  phone: null,
  website: null,
  tax_number: null,
  invoice_footer: null,
  invoice_prefix: "INV-",
  invoice_next_number: 1,
  invoice_pad_width: 4,
  bill_prefix: "BILL-",
  bill_next_number: 1,
  bill_pad_width: 4,
};

const CURRENCIES = [
  { code: "USD", symbol: "$" }, { code: "EUR", symbol: "€" }, { code: "GBP", symbol: "£" },
  { code: "INR", symbol: "₹" }, { code: "JPY", symbol: "¥" }, { code: "AUD", symbol: "A$" },
  { code: "CAD", symbol: "C$" }, { code: "CHF", symbol: "CHF" }, { code: "CNY", symbol: "¥" },
  { code: "AED", symbol: "د.إ" }, { code: "SAR", symbol: "﷼" }, { code: "ZAR", symbol: "R" },
  { code: "BRL", symbol: "R$" }, { code: "MXN", symbol: "Mex$" }, { code: "SGD", symbol: "S$" },
  { code: "HKD", symbol: "HK$" }, { code: "NZD", symbol: "NZ$" }, { code: "SEK", symbol: "kr" },
  { code: "NOK", symbol: "kr" }, { code: "DKK", symbol: "kr" },
  // West African currencies
  { code: "XOF", symbol: "CFA" },    // West African CFA franc (BCEAO: Senegal, Côte d'Ivoire, Mali, Burkina Faso, Benin, Togo, Niger, Guinea-Bissau)
  { code: "NGN", symbol: "₦" },      // Nigerian Naira
  { code: "GHS", symbol: "₵" },      // Ghanaian Cedi
  { code: "XAF", symbol: "FCFA" },   // Central African CFA franc (Cameroon, etc.)
  { code: "GMD", symbol: "D" },      // Gambian Dalasi
  { code: "GNF", symbol: "FG" },     // Guinean Franc
  { code: "LRD", symbol: "L$" },     // Liberian Dollar
  { code: "SLL", symbol: "Le" },     // Sierra Leonean Leone
  { code: "CVE", symbol: "$" },      // Cape Verdean Escudo
  { code: "MRU", symbol: "UM" },     // Mauritanian Ouguiya
];

const LOCALES = [
  { value: "en-US", label: "1,234.56 (US English)" },
  { value: "en-GB", label: "1,234.56 (UK English)" },
  { value: "de-DE", label: "1.234,56 (German)" },
  { value: "fr-FR", label: "1 234,56 (French)" },
  { value: "en-IN", label: "1,23,456.78 (Indian)" },
  { value: "es-ES", label: "1.234,56 (Spanish)" },
  { value: "ja-JP", label: "1,234.56 (Japanese)" },
];

const DATE_FORMATS = [
  { value: "yyyy-MM-dd", label: "2025-12-31" },
  { value: "dd/MM/yyyy", label: "31/12/2025" },
  { value: "MM/dd/yyyy", label: "12/31/2025" },
  { value: "dd MMM yyyy", label: "31 Dec 2025" },
  { value: "MMM dd, yyyy", label: "Dec 31, 2025" },
];

const Settings = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle();
      if (error) { toast.error(error.message); setLoading(false); return; }
      if (data) setProfile({ ...empty, ...(data as any) });
      setLoading(false);
    })();
  }, [user]);

  const update = <K extends keyof Profile>(k: K, v: Profile[K]) => setProfile((p) => ({ ...p, [k]: v }));

  const handleCurrencyChange = (code: string) => {
    const c = CURRENCIES.find((x) => x.code === code);
    setProfile((p) => ({ ...p, base_currency: code, currency_symbol: c?.symbol ?? p.currency_symbol }));
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 2 * 1024 * 1024) { toast.error("Logo must be under 2 MB"); return; }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${user.id}/logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("business-logos").upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("business-logos").getPublicUrl(path);
      update("logo_url", pub.publicUrl);
      toast.success("Logo uploaded — remember to Save");
    } catch (err: any) {
      toast.error(err.message ?? "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removeLogo = () => update("logo_url", null);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const payload = { ...profile, user_id: user.id };
    delete (payload as any).id;
    const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "user_id" });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setFormatSettings(profile);
    toast.success("Settings saved");
  };

  if (loading) {
    return (
      <>
        <PageHeader title="Settings" description="Loading…" />
        <div className="p-6 text-sm text-muted-foreground">Loading…</div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Settings"
        description="Business identity, branding, and number formatting"
        actions={
          <Button onClick={save} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />{saving ? "Saving…" : "Save changes"}
          </Button>
        }
      />
      <div className="p-6 max-w-4xl space-y-6">
        {/* Branding */}
        <Card className="shadow-[var(--shadow-card)]">
          <CardHeader>
            <CardTitle className="text-base">Brand</CardTitle>
            <CardDescription>Logo and business name shown on invoices, bills, and statements.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center gap-5">
              <div className="h-24 w-24 rounded-lg border bg-muted/30 flex items-center justify-center overflow-hidden shrink-0">
                {profile.logo_url ? (
                  <img src={profile.logo_url} alt="Logo" className="h-full w-full object-contain" />
                ) : (
                  <Building2 className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              <div className="space-y-2">
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" hidden onChange={handleLogoUpload} />
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                    <Upload className="h-4 w-4 mr-2" />{uploading ? "Uploading…" : "Upload logo"}
                  </Button>
                  {profile.logo_url && (
                    <Button variant="outline" size="sm" onClick={removeLogo}>
                      <Trash2 className="h-4 w-4 mr-2" />Remove
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">PNG, JPG, SVG or WEBP. Max 2 MB. Square works best.</p>
              </div>
            </div>

            <Separator />

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Business name *</Label>
                <Input value={profile.business_name} onChange={(e) => update("business_name", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Tax / VAT / GST number</Label>
                <Input value={profile.tax_number ?? ""} onChange={(e) => update("tax_number", e.target.value || null)} placeholder="Optional" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact */}
        <Card className="shadow-[var(--shadow-card)]">
          <CardHeader>
            <CardTitle className="text-base">Contact</CardTitle>
            <CardDescription>Shown in the header of printed documents.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>Address</Label>
              <Textarea rows={3} value={profile.address ?? ""} onChange={(e) => update("address", e.target.value || null)} placeholder="Street, City, Country" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={profile.email ?? ""} onChange={(e) => update("email", e.target.value || null)} />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={profile.phone ?? ""} onChange={(e) => update("phone", e.target.value || null)} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Website</Label>
              <Input value={profile.website ?? ""} onChange={(e) => update("website", e.target.value || null)} placeholder="https://…" />
            </div>
          </CardContent>
        </Card>

        {/* Currency & numbers */}
        <Card className="shadow-[var(--shadow-card)]">
          <CardHeader>
            <CardTitle className="text-base">Currency & numbers</CardTitle>
            <CardDescription>How money and numbers are displayed across the app.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Base currency</Label>
              <Select value={profile.base_currency} onValueChange={handleCurrencyChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>{c.code} — {c.symbol}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Currency symbol</Label>
              <Input value={profile.currency_symbol} onChange={(e) => update("currency_symbol", e.target.value)} maxLength={6} />
            </div>
            <div className="space-y-2">
              <Label>Symbol position</Label>
              <Select value={profile.currency_position} onValueChange={(v) => update("currency_position", v as "before" | "after")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="before">Before — {profile.currency_symbol}1,234.56</SelectItem>
                  <SelectItem value="after">After — 1,234.56 {profile.currency_symbol}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Number format</Label>
              <Select value={profile.number_format} onValueChange={(v) => update("number_format", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LOCALES.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Decimal places</Label>
              <Select value={String(profile.decimal_places)} onValueChange={(v) => update("decimal_places", Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[0, 1, 2, 3, 4].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Date format</Label>
              <Select value={profile.date_format} onValueChange={(v) => update("date_format", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DATE_FORMATS.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2 rounded-lg border bg-muted/20 p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1">Preview</p>
              <p className="text-2xl font-semibold num">{fmtMoney(1234567.891, profile)}</p>
            </div>
          </CardContent>
        </Card>

        {/* Numbering */}
        <Card className="shadow-[var(--shadow-card)]">
          <CardHeader>
            <CardTitle className="text-base">Document numbering</CardTitle>
            <CardDescription>Auto-generated numbers for new invoices and bills. The next number advances automatically each time a document is created.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {(["invoice", "bill"] as const).map((kind) => {
              const prefixKey = kind === "invoice" ? "invoice_prefix" : "bill_prefix";
              const nextKey = kind === "invoice" ? "invoice_next_number" : "bill_next_number";
              const padKey = kind === "invoice" ? "invoice_pad_width" : "bill_pad_width";
              const prefix = profile[prefixKey] ?? "";
              const next = profile[nextKey] ?? 1;
              const pad = Math.max(1, profile[padKey] ?? 4);
              const sample = `${prefix}${String(next).padStart(pad, "0")}`;
              return (
                <div key={kind} className="grid gap-4 md:grid-cols-4 items-end">
                  <div className="md:col-span-4">
                    <p className="text-sm font-medium capitalize">{kind === "invoice" ? "Sales invoices" : "Purchase bills"}</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Prefix</Label>
                    <Input value={prefix} onChange={(e) => update(prefixKey, e.target.value)} placeholder={kind === "invoice" ? "INV-" : "BILL-"} />
                  </div>
                  <div className="space-y-2">
                    <Label>Next number</Label>
                    <Input
                      type="number"
                      min={1}
                      value={next}
                      onChange={(e) => update(nextKey, Math.max(1, parseInt(e.target.value || "1", 10)))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Pad width</Label>
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      value={pad}
                      onChange={(e) => update(padKey, Math.min(10, Math.max(1, parseInt(e.target.value || "4", 10))))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Preview</Label>
                    <div className="h-10 rounded-md border bg-muted/20 px-3 flex items-center text-sm font-mono">{sample}</div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Footer text */}
        <Card className="shadow-[var(--shadow-card)]">
          <CardHeader>
            <CardTitle className="text-base">Document footer</CardTitle>
            <CardDescription>Optional message shown at the bottom of printed invoices, bills, and statements.</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea rows={3} value={profile.invoice_footer ?? ""} onChange={(e) => update("invoice_footer", e.target.value || null)} placeholder="Thank you for your business. Payment terms: net 30." />
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default Settings;
