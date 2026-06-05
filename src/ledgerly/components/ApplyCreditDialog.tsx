import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { formatMoney, formatDate } from "@/lib/format";

type Kind = "customer" | "supplier";

interface Doc {
  id: string;
  number: string;
  date: string;
  total: number;
  paid_amount: number;
  balance: number;
}

interface PaymentRow {
  id: string;
  amount: number;
  payment_date: string;
  remaining: number;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  kind: Kind;
  contactId: string;
  availableCredit: number;
  currency: string;
  onApplied: () => void;
}

export function ApplyCreditDialog({ open, onOpenChange, kind, contactId, availableCredit, currency, onApplied }: Props) {
  const { companyId } = useCompany();
  const direction = kind === "customer" ? "in" : "out";
  const docLabel = kind === "customer" ? "Invoice" : "Bill";

  const [docs, setDocs] = useState<Doc[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [docId, setDocId] = useState("");
  const [amount, setAmount] = useState("0");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !contactId) return;
    (async () => {
      setLoading(true);
      try {
        // Open docs for this contact
        if (kind === "customer") {
          const { data, error } = await supabase
            .from("invoices")
            .select("id, invoice_number, invoice_date, total, paid_amount, status")
            .eq("contact_id", contactId)
            .in("status", ["open", "partial"])
            .order("invoice_date", { ascending: true });
          if (error) throw error;
          setDocs((data ?? []).map((d) => ({
            id: d.id, number: d.invoice_number, date: d.invoice_date,
            total: Number(d.total), paid_amount: Number(d.paid_amount),
            balance: Number(d.total) - Number(d.paid_amount),
          })).filter((d) => d.balance > 0.0001));
        } else {
          const { data, error } = await supabase
            .from("bills")
            .select("id, bill_number, bill_date, total, paid_amount, status")
            .eq("contact_id", contactId)
            .in("status", ["open", "partial"])
            .order("bill_date", { ascending: true });
          if (error) throw error;
          setDocs((data ?? []).map((d) => ({
            id: d.id, number: d.bill_number, date: d.bill_date,
            total: Number(d.total), paid_amount: Number(d.paid_amount),
            balance: Number(d.total) - Number(d.paid_amount),
          })).filter((d) => d.balance > 0.0001));
        }

        // Payments with remaining unallocated
        const { data: pays } = await supabase
          .from("payments")
          .select("id, amount, payment_date")
          .eq("contact_id", contactId)
          .eq("direction", direction)
          .order("payment_date", { ascending: true });
        const payIds = (pays ?? []).map((p) => p.id);
        let allocByPay: Record<string, number> = {};
        if (payIds.length) {
          const { data: allocs } = await supabase
            .from("payment_allocations")
            .select("payment_id, amount")
            .in("payment_id", payIds);
          (allocs ?? []).forEach((a) => {
            allocByPay[a.payment_id] = (allocByPay[a.payment_id] ?? 0) + Number(a.amount);
          });
        }
        const rows: PaymentRow[] = (pays ?? []).map((p) => ({
          id: p.id,
          amount: Number(p.amount),
          payment_date: p.payment_date,
          remaining: Math.max(0, Number(p.amount) - (allocByPay[p.id] ?? 0)),
        })).filter((p) => p.remaining > 0.0001);
        setPayments(rows);

        setDocId("");
        setAmount(String(availableCredit.toFixed(2)));
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, contactId, kind, direction, availableCredit]);

  const selectedDoc = useMemo(() => docs.find((d) => d.id === docId), [docs, docId]);

  const onPickDoc = (id: string) => {
    setDocId(id);
    const d = docs.find((x) => x.id === id);
    if (d) {
      const apply = Math.min(d.balance, availableCredit);
      setAmount(apply.toFixed(2));
    }
  };

  const handleApply = async () => {
    if (!selectedDoc) { toast.error(`Select a ${docLabel.toLowerCase()}`); return; }
    const amt = parseFloat(amount || "0") || 0;
    if (amt <= 0) { toast.error("Amount must be greater than zero"); return; }
    if (amt > selectedDoc.balance + 0.0001) { toast.error(`Exceeds ${docLabel.toLowerCase()} balance`); return; }
    if (amt > availableCredit + 0.0001) { toast.error("Exceeds available credit"); return; }

    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not authenticated");
      const userId = u.user.id;
      if (!companyId) throw new Error("No active company");

      // Distribute amount across payments FIFO
      let remaining = amt;
      const inserts: Array<{ user_id: string; payment_id: string; amount: number; invoice_id: string | null; bill_id: string | null }> = [];
      for (const p of payments) {
        if (remaining <= 0.0001) break;
        const take = Math.min(p.remaining, remaining);
        if (take <= 0.0001) continue;
        inserts.push({
          user_id: userId,
          payment_id: p.id,
          amount: Number(take.toFixed(2)),
          invoice_id: kind === "customer" ? selectedDoc.id : null,
          bill_id: kind === "supplier" ? selectedDoc.id : null,
        });
        remaining -= take;
      }
      if (inserts.length === 0 || remaining > 0.0001) {
        throw new Error("Not enough unallocated credit available");
      }

      const { error: aErr } = await supabase
        .from("payment_allocations")
        .insert(inserts.map((i) => ({ ...i, company_id: companyId })));
      if (aErr) throw aErr;

      // Update doc paid_amount + status
      const newPaid = Number(selectedDoc.paid_amount) + amt;
      const newStatus = newPaid + 0.0001 >= selectedDoc.total ? "paid" : "partial";
      if (kind === "customer") {
        const { error } = await supabase.from("invoices")
          .update({ paid_amount: newPaid, status: newStatus }).eq("id", selectedDoc.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("bills")
          .update({ paid_amount: newPaid, status: newStatus }).eq("id", selectedDoc.id);
        if (error) throw error;
      }

      toast.success(`Applied ${formatMoney(amt, currency)} to ${selectedDoc.number}`);
      onApplied();
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Apply credit to a {docLabel.toLowerCase()}</DialogTitle>
          <DialogDescription>
            Available credit: <span className="font-semibold text-success">{formatMoney(availableCredit, currency)}</span>
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-muted-foreground py-4">Loading…</p>
        ) : docs.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No open {docLabel.toLowerCase()}s for this contact.</p>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{docLabel}</Label>
              <Select value={docId} onValueChange={onPickDoc}>
                <SelectTrigger><SelectValue placeholder={`Select ${docLabel.toLowerCase()}`} /></SelectTrigger>
                <SelectContent>
                  {docs.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.number} — {formatDate(d.date)} · Bal {formatMoney(d.balance, currency)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedDoc && (
              <div className="rounded-md border border-border bg-muted/40 p-3 text-sm grid grid-cols-3 gap-3">
                <div><p className="text-xs text-muted-foreground">Total</p><p className="num font-medium">{formatMoney(selectedDoc.total, currency)}</p></div>
                <div><p className="text-xs text-muted-foreground">Paid</p><p className="num font-medium">{formatMoney(selectedDoc.paid_amount, currency)}</p></div>
                <div><p className="text-xs text-muted-foreground">Balance</p><p className="num font-medium text-primary">{formatMoney(selectedDoc.balance, currency)}</p></div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Amount to apply</Label>
              <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleApply} disabled={saving || loading || docs.length === 0}>
            {saving ? "Applying…" : "Apply credit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}