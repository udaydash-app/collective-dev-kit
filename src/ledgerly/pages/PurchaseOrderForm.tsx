import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/ledgerly/integrations/supabase/client";
import { PageHeader } from "@/ledgerly/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Save, ArrowLeft, Printer, FileDown, XCircle, Send } from "lucide-react";
import { toast } from "sonner";
import { formatMoney } from "@/ledgerly/lib/format";
import { QuickAddItemDialog, type QuickItem } from "@/ledgerly/components/QuickAddItemDialog";
import { QuickAddContactDialog, type QuickContact } from "@/ledgerly/components/QuickAddContactDialog";
import { useCompany } from "@/ledgerly/contexts/CompanyContext";

type POStatus = "draft" | "sent" | "partial" | "billed" | "cancelled";

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

const PurchaseOrderForm = () => {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === "new";
  const navigate = useNavigate();
  const { companyId } = useCompany();

  const [suppliers, setSuppliers] = useState<Contact[]>([]);
  const [items, setItems] = useState<ItemRef[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [converting, setConverting] = useState(false);

  const [status, setStatus] = useState<POStatus>("draft");
  const [poNumber, setPoNumber] = useState("");
  const [poDate, setPoDate] = useState(todayISO());
  const [expectedDate, setExpectedDate] = useState<string>("");
  const [creditDays, setCreditDays] = useState<string>("");
  const [contactId, setContactId] = useState<string>("");
  const [taxPercent, setTaxPercent] = useState("0");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddLineIdx, setQuickAddLineIdx] = useState<number | null>(null);
  const [quickAddContactOpen, setQuickAddContactOpen] = useState(false);

  const handleItemCreated = (item: QuickItem) => {
    setItems((prev) => [...prev, item as ItemRef].sort((a, b) => a.name.localeCompare(b.name)));
    if (quickAddLineIdx !== null) {
      setLines((prev) => prev.map((l, idx) => idx === quickAddLineIdx ? {
        ...l, item_id: item.id, description: item.name, rate: String(item.purchase_rate || 0),
      } : l));
    }
    setQuickAddLineIdx(null);
  };

  const handleContactCreated = (contact: QuickContact) => {
    setSuppliers((prev) => [...prev, { id: contact.id, name: contact.name, type: contact.type }].sort((a, b) => a.name.localeCompare(b.name)));
    setContactId(contact.id);
  };

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

  useEffect(() => {
    if (isNew && companyId) {
      (async () => {
        const { data, error } = await (supabase as any).rpc("next_doc_number", { doc_kind: "po", p_company_id: companyId });
        if (error) {
          setPoNumber(`PO-${todayISO().replace(/-/g, "")}-001`);
          return;
        }
        setPoNumber(data as string);
      })();
      return;
    }
    if (isNew) return;
    (async () => {
      setLoading(true);
      const { data: p, error } = await (supabase as any).from("purchase_orders").select("*").eq("id", id).single();
      if (error || !p) { toast.error(error?.message ?? "Not found"); navigate("/ledgerly/purchase-orders"); return; }
      setStatus(p.status);
      setPoNumber(p.po_number);
      setPoDate(p.po_date);
      setExpectedDate(p.expected_date ?? "");
      if (p.expected_date && p.po_date) {
        setCreditDays(String(diffDays(p.po_date, p.expected_date)));
      }
      setContactId(p.contact_id);
      setTaxPercent(String(p.tax_percent));
      setNotes(p.notes ?? "");
      const { data: ls } = await (supabase as any).from("purchase_order_lines").select("*").eq("po_id", id).order("created_at");
      setLines(((ls ?? []) as Array<any>).map((l) => ({
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

  const isLocked = status === "cancelled";
  const subtotal = useMemo(() => lines.reduce((s, l) => s + (parseFloat(l.quantity || "0") || 0) * (parseFloat(l.rate || "0") || 0), 0), [lines]);
  const taxAmount = useMemo(() => subtotal * ((parseFloat(taxPercent || "0") || 0) / 100), [subtotal, taxPercent]);
  const total = subtotal + taxAmount;

  const updateLine = (i: number, patch: Partial<Line>) => setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const onPickItem = (i: number, itemId: string) => {
    const it = items.find((x) => x.id === itemId);
    updateLine(i, { item_id: itemId, description: it?.name ?? "", rate: it ? String(it.purchase_rate || 0) : "0" });
  };

  const validate = () => {
    if (!poNumber.trim()) return "PO number is required";
    if (!contactId) return "Supplier is required";
    if (!poDate) return "PO date is required";
    const valid = lines.filter((l) => parseFloat(l.quantity || "0") > 0 && parseFloat(l.rate || "0") >= 0 && (l.item_id || l.description.trim()));
    if (valid.length === 0) return "Add at least one line";
    return null;
  };

  const persist = async (newStatus?: POStatus): Promise<string | null> => {
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
        po_number: poNumber.trim(),
        po_date: poDate,
        expected_date: expectedDate || null,
        contact_id: contactId,
        tax_percent: parseFloat(taxPercent || "0") || 0,
        tax_amount: taxAmount,
        subtotal,
        total,
        notes: notes || null,
        ...(newStatus ? { status: newStatus } : {}),
      };

      let poId = id && !isNew ? id : "";
      if (isNew) {
        const { data, error } = await (supabase as any).from("purchase_orders").insert(header).select("id").single();
        if (error || !data) throw error ?? new Error("Insert failed");
        poId = data.id;
      } else {
        const { error } = await (supabase as any).from("purchase_orders").update(header).eq("id", poId);
        if (error) throw error;
        await (supabase as any).from("purchase_order_lines").delete().eq("po_id", poId);
      }

      const linePayload = lines
        .filter((l) => parseFloat(l.quantity || "0") > 0 && (l.item_id || l.description.trim()))
        .map((l) => {
          const qty = parseFloat(l.quantity || "0") || 0;
          const rate = parseFloat(l.rate || "0") || 0;
          return {
            user_id: userId,
            company_id: companyId,
            po_id: poId,
            item_id: l.item_id,
            description: l.description || null,
            quantity: qty,
            rate,
            amount: qty * rate,
          };
        });
      if (linePayload.length > 0) {
        const { error } = await (supabase as any).from("purchase_order_lines").insert(linePayload);
        if (error) throw error;
      }

      if (newStatus) setStatus(newStatus);
      return poId;
    } catch (e) {
      toast.error((e as Error).message);
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    const poId = await persist();
    if (!poId) return;
    toast.success("Purchase order saved");
    if (isNew) navigate(`/ledgerly/purchase-orders/${poId}`, { replace: true });
  };

  const handleMarkSent = async () => {
    const poId = await persist("sent");
    if (!poId) return;
    toast.success("Marked as sent");
    if (isNew) navigate(`/ledgerly/purchase-orders/${poId}`, { replace: true });
  };

  const handleCancel = async () => {
    if (!id || isNew) return;
    if (!confirm("Cancel this purchase order?")) return;
    const { error } = await (supabase as any).from("purchase_orders").update({ status: "cancelled" }).eq("id", id);
    if (error) return toast.error(error.message);
    setStatus("cancelled");
    toast.success("Purchase order cancelled");
  };

  const handleConvertToBill = async () => {
    if (!id || isNew) {
      toast.error("Save the PO first");
      return;
    }
    setConverting(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not authenticated");
      const userId = u.user.id;
      if (!companyId) throw new Error("No active company");

      const { data: billNumData, error: numErr } = await (supabase as any).rpc("next_doc_number", { doc_kind: "bill", p_company_id: companyId });
      if (numErr) throw numErr;

      const billHeader = {
        user_id: userId,
        company_id: companyId,
        bill_number: billNumData as string,
        bill_date: todayISO(),
        due_date: expectedDate || null,
        contact_id: contactId,
        tax_percent: parseFloat(taxPercent || "0") || 0,
        tax_amount: taxAmount,
        subtotal,
        total,
        notes: notes ? `From PO ${poNumber}\n${notes}` : `From PO ${poNumber}`,
        po_id: id,
      };
      const { data: bill, error: bErr } = await supabase.from("bills").insert(billHeader as any).select("id").single();
      if (bErr || !bill) throw bErr ?? new Error("Bill create failed");

      const billLines = lines
        .filter((l) => parseFloat(l.quantity || "0") > 0 && (l.item_id || l.description.trim()))
        .map((l) => {
          const qty = parseFloat(l.quantity || "0") || 0;
          const rate = parseFloat(l.rate || "0") || 0;
          return {
            user_id: userId,
            company_id: companyId,
            bill_id: bill.id,
            item_id: l.item_id,
            description: l.description || null,
            quantity: qty,
            rate,
            amount: qty * rate,
          };
        });
      if (billLines.length > 0) {
        const { error } = await supabase.from("bill_lines").insert(billLines);
        if (error) throw error;
      }

      await (supabase as any).from("purchase_orders").update({ status: "billed" }).eq("id", id);
      setStatus("billed");
      toast.success("Bill created from PO. Review and post it.");
      navigate(`/ledgerly/bills/${bill.id}`);
    } catch (e) {
      toast.error("Convert failed: " + (e as Error).message);
    } finally {
      setConverting(false);
    }
  };

  if (loading) return <div className="p-10 text-sm text-muted-foreground">Loading…</div>;

  return (
    <>
      <PageHeader
        title={isNew ? "New Purchase Order" : `PO ${poNumber}`}
        description={isNew ? "Order goods or services from a supplier" : "Purchase order details"}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" onClick={() => navigate("/ledgerly/purchase-orders")}><ArrowLeft className="h-4 w-4 mr-1.5" />Back</Button>
            {!isNew && (
              <Button variant="outline" onClick={() => navigate(`/ledgerly/purchase-orders/${id}/print`)}>
                <Printer className="h-4 w-4 mr-1.5" />Print / PDF
              </Button>
            )}
            {!isLocked && (
              <>
                <Button variant="outline" onClick={handleSave} disabled={saving || converting}>
                  <Save className="h-4 w-4 mr-1.5" />Save
                </Button>
                {status === "draft" && (
                  <Button variant="outline" onClick={handleMarkSent} disabled={saving || converting}>
                    <Send className="h-4 w-4 mr-1.5" />Save & Mark Sent
                  </Button>
                )}
                {!isNew && (
                  <Button onClick={handleConvertToBill} disabled={saving || converting}>
                    <FileDown className="h-4 w-4 mr-1.5" />{converting ? "Converting…" : "Convert to Bill"}
                  </Button>
                )}
                {!isNew && (
                  <Button variant="ghost" onClick={handleCancel} disabled={saving || converting}>
                    <XCircle className="h-4 w-4 mr-1.5" />Cancel PO
                  </Button>
                )}
              </>
            )}
          </div>
        }
      />
      <div className="p-6 space-y-4">
        {isLocked && (
          <Card className="border-primary/30 bg-primary-muted/30">
            <CardContent className="p-4 text-sm flex items-center gap-2">
              <Badge className="bg-primary text-primary-foreground border-0 capitalize">{status}</Badge>
              <span className="text-muted-foreground">This PO has been cancelled.</span>
            </CardContent>
          </Card>
        )}
        {status === "billed" && (
          <Card className="border-amber-500/40 bg-amber-500/10">
            <CardContent className="p-4 text-sm flex items-center gap-2">
              <Badge className="bg-amber-500 text-white border-0 capitalize">billed</Badge>
              <span className="text-muted-foreground">This PO was converted to a bill. Editing here will not update the linked bill.</span>
            </CardContent>
          </Card>
        )}

        <Card className="shadow-[var(--shadow-card)]">
          <CardContent className="p-5 grid gap-4 md:grid-cols-4">
            <div className="space-y-2 md:col-span-2">
              <Label>Supplier *</Label>
              <Select value={contactId} onValueChange={(v) => { if (v === "__new__") { setQuickAddContactOpen(true); return; } setContactId(v); }} disabled={isLocked}>
                <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  <div className="border-t border-border mt-1 pt-1">
                    <SelectItem value="__new__" className="text-primary font-medium">+ Create new supplier…</SelectItem>
                  </div>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>PO # *</Label>
              <Input value={poNumber} onChange={(e) => setPoNumber(e.target.value)} disabled={isLocked} />
            </div>
            <div className="space-y-2">
              <Label>Tax %</Label>
              <Input type="number" step="0.01" value={taxPercent} onChange={(e) => setTaxPercent(e.target.value)} disabled={isLocked} />
            </div>
            <div className="space-y-2">
              <Label>PO date *</Label>
              <Input type="date" value={poDate} onChange={(e) => {
                const v = e.target.value;
                setPoDate(v);
                const n = parseInt(creditDays, 10);
                if (v && !isNaN(n)) setExpectedDate(addDays(v, n));
              }} disabled={isLocked} />
            </div>
            <div className="space-y-2">
              <Label>Credit days</Label>
              <Input type="number" min="0" step="1" value={creditDays} placeholder="e.g. 30" onChange={(e) => {
                const v = e.target.value;
                setCreditDays(v);
                const n = parseInt(v, 10);
                if (poDate && !isNaN(n)) setExpectedDate(addDays(poDate, n));
              }} disabled={isLocked} />
            </div>
            <div className="space-y-2">
              <Label>Expected delivery</Label>
              <Input type="date" value={expectedDate} onChange={(e) => {
                const v = e.target.value;
                setExpectedDate(v);
                if (v && poDate) setCreditDays(String(diffDays(poDate, v)));
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
                      <Select value={l.item_id ?? ""} onValueChange={(v) => { if (v === "__new__") { setQuickAddLineIdx(i); setQuickAddOpen(true); return; } onPickItem(i, v); }} disabled={isLocked}>
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
              <Textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={isLocked} placeholder="Delivery instructions, terms…" />
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

export default PurchaseOrderForm;
