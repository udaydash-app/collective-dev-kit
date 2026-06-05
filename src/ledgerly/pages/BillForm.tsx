import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Save, CheckCircle2, ArrowLeft, Printer } from "lucide-react";
import { toast } from "sonner";
import { formatMoney } from "@/lib/format";
import { postBill } from "@/lib/posting";
import { QuickAddItemDialog, type QuickItem } from "@/components/QuickAddItemDialog";
import { QuickAddContactDialog, type QuickContact } from "@/components/QuickAddContactDialog";
import { useCompany } from "@/contexts/CompanyContext";

interface Contact { id: string; name: string; type: string; }
interface ItemRef { id: string; name: string; sku: string | null; unit: string; purchase_rate: number; }

interface Line {
  id?: string;
  item_id: string | null;
  description: string;
  quantity: string;
  rate: string;
}

const emptyLine = (): Line => ({ item_id: null, description: "", quantity: "1", rate: "0" });

const todayISO = () => new Date().toISOString().slice(0, 10);

const addDays = (iso: string, days: number) => {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};
const diffDays = (from: string, to: string) => {
  const a = new Date(from + "T00:00:00").getTime();
  const b = new Date(to + "T00:00:00").getTime();
  return Math.round((b - a) / 86400000);
};

const BillForm = () => {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === "new";
  const navigate = useNavigate();
  const { companyId } = useCompany();

  const [suppliers, setSuppliers] = useState<Contact[]>([]);
  const [items, setItems] = useState<ItemRef[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [posting, setPosting] = useState(false);

  const [status, setStatus] = useState<"draft" | "open" | "partial" | "paid" | "void">("draft");
  const [billNumber, setBillNumber] = useState("");
  const [billDate, setBillDate] = useState(todayISO());
  const [dueDate, setDueDate] = useState<string>("");
  const [creditDays, setCreditDays] = useState<string>("");
  const [contactId, setContactId] = useState<string>("");
  const [taxPercent, setTaxPercent] = useState("0");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddLineIdx, setQuickAddLineIdx] = useState<number | null>(null);
  const [quickAddContactOpen, setQuickAddContactOpen] = useState(false);

  const handleContactCreated = (c: QuickContact) => {
    setSuppliers((prev) => [...prev, c].sort((a, b) => a.name.localeCompare(b.name)));
    setContactId(c.id);
  };

  const handleItemCreated = (item: QuickItem) => {
    setItems((prev) => [...prev, item].sort((a, b) => a.name.localeCompare(b.name)));
    if (quickAddLineIdx !== null) {
      updateLine(quickAddLineIdx, {
        item_id: item.id,
        description: item.name,
        rate: String(item.purchase_rate || 0),
      });
    }
    setQuickAddLineIdx(null);
  };

  // Load lookups
  useEffect(() => {
    if (!companyId) return;
    (async () => {
      const [{ data: c }, { data: it }] = await Promise.all([
        supabase.from("contacts").select("id, name, type").eq("company_id", companyId).in("type", ["supplier", "both"]).eq("is_active", true).order("name"),
        supabase.from("items").select("id, name, sku, unit, purchase_rate").eq("company_id", companyId).eq("is_active", true).order("name"),
      ]);
      setSuppliers((c ?? []) as Contact[]);
      setItems((it ?? []) as ItemRef[]);
    })();
  }, [companyId]);

  // Load existing bill
  useEffect(() => {
    if (isNew && companyId) {
      (async () => {
        const { data, error } = await (supabase as any).rpc("next_doc_number", { doc_kind: "bill", p_company_id: companyId });
        if (error) {
          const start = todayISO();
          setBillNumber(`BILL-${start.replace(/-/g, "")}-001`);
          return;
        }
        setBillNumber(data as string);
      })();
      return;
    }
    if (isNew) return;
    (async () => {
      setLoading(true);
      const { data: b, error } = await supabase.from("bills").select("*").eq("id", id).single();
      if (error || !b) { toast.error(error?.message ?? "Not found"); navigate("/bills"); return; }
      setStatus(b.status);
      setBillNumber(b.bill_number);
      setBillDate(b.bill_date);
      setDueDate(b.due_date ?? "");
      if (b.due_date && b.bill_date) {
        setCreditDays(String(diffDays(b.bill_date, b.due_date)));
      }
      setContactId(b.contact_id);
      setTaxPercent(String(b.tax_percent));
      setNotes(b.notes ?? "");
      const { data: ls } = await supabase.from("bill_lines").select("*").eq("bill_id", id).order("created_at");
      setLines(((ls ?? []) as Array<{ id: string; item_id: string | null; description: string | null; quantity: number; rate: number }>).map((l) => ({
        id: l.id,
        item_id: l.item_id,
        description: l.description ?? "",
        quantity: String(l.quantity),
        rate: String(l.rate),
      })));
      if ((ls ?? []).length === 0) setLines([emptyLine()]);
      setLoading(false);
    })();
  }, [id, isNew, navigate, companyId]);

  const isLocked = status === "paid" || status === "void";
  const isPosted = status !== "draft";

  const subtotal = useMemo(() => lines.reduce((s, l) => s + (parseFloat(l.quantity || "0") || 0) * (parseFloat(l.rate || "0") || 0), 0), [lines]);
  const taxAmount = useMemo(() => subtotal * ((parseFloat(taxPercent || "0") || 0) / 100), [subtotal, taxPercent]);
  const total = subtotal + taxAmount;

  const updateLine = (i: number, patch: Partial<Line>) => {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  };
  const onPickItem = (i: number, itemId: string) => {
    const it = items.find((x) => x.id === itemId);
    updateLine(i, {
      item_id: itemId,
      description: it?.name ?? "",
      rate: it ? String(it.purchase_rate || 0) : "0",
    });
  };

  const validate = () => {
    if (!billNumber.trim()) return "Bill number is required";
    if (!contactId) return "Supplier is required";
    if (!billDate) return "Bill date is required";
    const valid = lines.filter((l) => parseFloat(l.quantity || "0") > 0 && parseFloat(l.rate || "0") >= 0 && (l.item_id || l.description.trim()));
    if (valid.length === 0) return "Add at least one line";
    return null;
  };

  const persist = async (): Promise<string | null> => {
    const err = validate();
    if (err) { toast.error(err); return null; }
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not authenticated");
      const userId = u.user.id;
      if (!companyId) throw new Error("No active company");

      const header = {
        user_id: userId,
        company_id: companyId,
        bill_number: billNumber.trim(),
        bill_date: billDate,
        due_date: dueDate || null,
        contact_id: contactId,
        tax_percent: parseFloat(taxPercent || "0") || 0,
        tax_amount: taxAmount,
        subtotal,
        total,
        notes: notes || null,
      };

      let billId = id && !isNew ? id : "";
      if (isNew) {
        const { data, error } = await supabase.from("bills").insert(header).select("id").single();
        if (error || !data) throw error ?? new Error("Insert failed");
        billId = data.id;
      } else {
        const { error } = await supabase.from("bills").update(header).eq("id", billId);
        if (error) throw error;
        // wipe and reinsert lines (only for draft)
        await supabase.from("bill_lines").delete().eq("bill_id", billId);
      }

      const linePayload = lines
        .filter((l) => parseFloat(l.quantity || "0") > 0 && (l.item_id || l.description.trim()))
        .map((l) => {
          const qty = parseFloat(l.quantity || "0") || 0;
          const rate = parseFloat(l.rate || "0") || 0;
          return {
            user_id: userId,
            company_id: companyId,
            bill_id: billId,
            item_id: l.item_id,
            description: l.description || null,
            quantity: qty,
            rate,
            amount: qty * rate,
          };
        });
      if (linePayload.length > 0) {
        const { error } = await supabase.from("bill_lines").insert(linePayload);
        if (error) throw error;
      }

      return billId;
    } catch (e) {
      toast.error((e as Error).message);
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    const billId = await persist();
    if (!billId) return;
    toast.success("Bill saved as draft");
    if (isNew) navigate(`/bills/${billId}`, { replace: true });
  };

  const handleSaveAndPost = async () => {
    const billId = await persist();
    if (!billId) return;
    setPosting(true);
    try {
      await postBill(billId);
      toast.success("Bill posted. Inventory & journal updated.");
      navigate(`/bills/${billId}`, { replace: true });
      // reload state
      setStatus("open");
    } catch (e) {
      toast.error("Posting failed: " + (e as Error).message);
    } finally {
      setPosting(false);
    }
  };

  if (loading) {
    return <div className="p-10 text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <>
      <PageHeader
        title={isNew ? "New Bill" : `Bill ${billNumber}`}
        description={isNew ? "Record a supplier purchase" : "Bill details"}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate("/bills")}><ArrowLeft className="h-4 w-4 mr-1.5" />Back</Button>
            {!isNew && (
              <Button variant="outline" onClick={() => navigate(`/bills/${id}/print`)}>
                <Printer className="h-4 w-4 mr-1.5" />Print / PDF
              </Button>
            )}
            {!isLocked && (
              <>
                <Button variant="outline" onClick={handleSave} disabled={saving || posting}>
                  <Save className="h-4 w-4 mr-1.5" />Save draft
                </Button>
                <Button onClick={handleSaveAndPost} disabled={saving || posting}>
                  <CheckCircle2 className="h-4 w-4 mr-1.5" />{posting ? "Posting…" : "Save & Post"}
                </Button>
              </>
            )}
          </div>
        }
      />
      <div className="p-6 space-y-4">
        {isPosted && !isLocked && (
          <Card className="border-amber-500/40 bg-amber-500/10">
            <CardContent className="p-4 text-sm flex items-center gap-2">
              <Badge className="bg-amber-500 text-white border-0 capitalize">{status}</Badge>
              <span className="text-muted-foreground">This bill is posted. Editing will not automatically reverse or update existing journal entries or inventory movements.</span>
            </CardContent>
          </Card>
        )}
        {isLocked && (
          <Card className="border-primary/30 bg-primary-muted/30">
            <CardContent className="p-4 text-sm flex items-center gap-2">
              <Badge className="bg-primary text-primary-foreground border-0 capitalize">{status}</Badge>
              <span className="text-muted-foreground">This bill is {status} and cannot be edited.</span>
            </CardContent>
          </Card>
        )}

        <Card className="shadow-[var(--shadow-card)]">
          <CardContent className="p-5 grid gap-4 md:grid-cols-4">
            <div className="space-y-2 md:col-span-2">
              <Label>Supplier *</Label>
              <Select value={contactId} onValueChange={(v) => { if (v === "__new_contact__") { setQuickAddContactOpen(true); return; } setContactId(v); }} disabled={isLocked}>
                <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  <div className="border-t border-border mt-1 pt-1">
                    <SelectItem value="__new_contact__" className="text-primary font-medium">+ Create new supplier…</SelectItem>
                  </div>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Bill # *</Label>
              <Input value={billNumber} onChange={(e) => setBillNumber(e.target.value)} disabled={isLocked} />
            </div>
            <div className="space-y-2">
              <Label>Tax %</Label>
              <Input type="number" step="0.01" value={taxPercent} onChange={(e) => setTaxPercent(e.target.value)} disabled={isLocked} />
            </div>
            <div className="space-y-2">
              <Label>Bill date *</Label>
              <Input type="date" value={billDate} onChange={(e) => {
                const v = e.target.value;
                setBillDate(v);
                const n = parseInt(creditDays, 10);
                if (v && !isNaN(n)) setDueDate(addDays(v, n));
              }} disabled={isLocked} />
            </div>
            <div className="space-y-2">
              <Label>Credit days</Label>
              <Input type="number" min="0" step="1" value={creditDays} placeholder="e.g. 30" onChange={(e) => {
                const v = e.target.value;
                setCreditDays(v);
                const n = parseInt(v, 10);
                if (billDate && !isNaN(n)) setDueDate(addDays(billDate, n));
              }} disabled={isLocked} />
            </div>
            <div className="space-y-2">
              <Label>Due date</Label>
              <Input type="date" value={dueDate} onChange={(e) => {
                const v = e.target.value;
                setDueDate(v);
                if (v && billDate) setCreditDays(String(diffDays(billDate, v)));
                else setCreditDays("");
              }} disabled={isLocked} />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-[var(--shadow-card)]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[28%]">Item</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-28 text-right">Qty</TableHead>
                <TableHead className="w-32 text-right">Rate</TableHead>
                <TableHead className="w-32 text-right">Amount</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((l, i) => {
                const qty = parseFloat(l.quantity || "0") || 0;
                const rate = parseFloat(l.rate || "0") || 0;
                const amt = qty * rate;
                const it = items.find((x) => x.id === l.item_id);
                return (
                  <TableRow key={i}>
                    <TableCell>
                      <Select value={l.item_id ?? ""} onValueChange={(v) => {
                        if (v === "__new__") {
                          setQuickAddLineIdx(i);
                          setQuickAddOpen(true);
                          return;
                        }
                        onPickItem(i, v);
                      }} disabled={isLocked}>
                        <SelectTrigger><SelectValue placeholder="Pick item" /></SelectTrigger>
                        <SelectContent>
                          {items.map((it) => <SelectItem key={it.id} value={it.id}>{it.name}{it.sku ? ` (${it.sku})` : ""}</SelectItem>)}
                          <div className="border-t border-border mt-1 pt-1">
                            <SelectItem value="__new__" className="text-primary font-medium">+ Create new item…</SelectItem>
                          </div>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input value={l.description} onChange={(e) => updateLine(i, { description: e.target.value })} placeholder={it?.name ?? "Description"} disabled={isLocked} />
                    </TableCell>
                    <TableCell>
                      <Input type="number" step="0.0001" className="text-right" value={l.quantity} onChange={(e) => updateLine(i, { quantity: e.target.value })} disabled={isLocked} />
                      {it && <div className="text-[11px] text-muted-foreground text-right mt-1">{it.unit}</div>}
                    </TableCell>
                    <TableCell>
                      <Input type="number" step="0.0001" className="text-right" value={l.rate} onChange={(e) => updateLine(i, { rate: e.target.value })} disabled={isLocked} />
                    </TableCell>
                    <TableCell className="text-right num font-medium">{formatMoney(amt)}</TableCell>
                    <TableCell>
                      {!isLocked && lines.length > 1 && (
                        <Button variant="ghost" size="icon" onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {!isLocked && (
            <div className="p-3 border-t border-border">
              <Button variant="outline" size="sm" onClick={() => setLines((prev) => [...prev, emptyLine()])}>
                <Plus className="h-4 w-4 mr-1.5" />Add line
              </Button>
            </div>
          )}
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="shadow-[var(--shadow-card)]">
            <CardContent className="p-5 space-y-2">
              <Label>Notes</Label>
              <Textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={isLocked} placeholder="Internal notes (not shown on payment)…" />
            </CardContent>
          </Card>
          <Card className="shadow-[var(--shadow-card)]">
            <CardContent className="p-5 space-y-3">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span className="num">{formatMoney(subtotal)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Tax ({taxPercent || 0}%)</span><span className="num">{formatMoney(taxAmount)}</span></div>
              <div className="border-t border-border pt-3 flex justify-between font-semibold text-base"><span>Total</span><span className="num">{formatMoney(total)}</span></div>
            </CardContent>
          </Card>
        </div>
      </div>
      <QuickAddItemDialog open={quickAddOpen} onOpenChange={setQuickAddOpen} onCreated={handleItemCreated} context="purchase" />
      <QuickAddContactDialog open={quickAddContactOpen} onOpenChange={setQuickAddContactOpen} onCreated={handleContactCreated} defaultType="supplier" lockType />
    </>
  );
};

export default BillForm;
