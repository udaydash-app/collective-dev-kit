import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { formatMoney, formatDate } from "@/lib/format";
import { postPayment, reversePayment } from "@/lib/posting";
import { QuickAddContactDialog, type QuickContact } from "@/components/QuickAddContactDialog";
import { useCompany } from "@/contexts/CompanyContext";

const ON_ACCOUNT = "__on_account__";

interface Contact { id: string; name: string; type: string; }
interface Account { id: string; name: string; code: string | null; }
interface DocOption { id: string; number: string; date: string; total: number; paid_amount: number; balance: number; }

const todayISO = () => new Date().toISOString().slice(0, 10);

const PaymentForm = () => {
  const navigate = useNavigate();
  const { companyId } = useCompany();
  const [params] = useSearchParams();
  const { id: editId } = useParams<{ id: string }>();
  const isEdit = !!editId;
  const initialDirection = (params.get("type") === "in" ? "in" : "out") as "in" | "out";

  const [direction, setDirection] = useState<"in" | "out">(initialDirection);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [docs, setDocs] = useState<DocOption[]>([]);

  const [contactId, setContactId] = useState("");
  const [docId, setDocId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [mode, setMode] = useState<"cash" | "bank" | "other">("cash");
  const [paymentDate, setPaymentDate] = useState(todayISO());
  const [amount, setAmount] = useState("0");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(isEdit);
  const [originalDocBalance, setOriginalDocBalance] = useState<number | null>(null);
  const [quickAddContactOpen, setQuickAddContactOpen] = useState(false);

  const handleContactCreated = (c: QuickContact) => {
    setContacts((prev) => [...prev, { id: c.id, name: c.name, type: c.type }].sort((a, b) => a.name.localeCompare(b.name)));
    setContactId(c.id);
  };

  // Load contacts (filtered by direction) and cash/bank accounts
  useEffect(() => {
    if (!companyId) return;
    (async () => {
      const types: ("customer" | "supplier" | "both")[] =
        direction === "in" ? ["customer", "both"] : ["supplier", "both"];
      const [{ data: c }, { data: a }] = await Promise.all([
        supabase.from("contacts").select("id, name, type").eq("company_id", companyId).in("type", types).eq("is_active", true).order("name"),
        supabase.from("accounts").select("id, name, code").eq("company_id", companyId).in("code", ["1000", "1010"]).order("code"),
      ]);
      setContacts((c ?? []) as Contact[]);
      setAccounts((a ?? []) as Account[]);
      const cash = (a ?? []).find((x) => x.code === "1000");
      if (cash && !accountId) setAccountId(cash.id);
    })();
    if (!isEdit) {
      setDocId("");
      setDocs([]);
      setContactId("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [direction, companyId]);

  // Load existing payment when editing
  useEffect(() => {
    if (!isEdit || !editId) return;
    (async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("id", editId)
        .single();
      if (error || !data) {
        toast.error(error?.message ?? "Payment not found");
        navigate("/payments");
        return;
      }
      setDirection(data.direction as "in" | "out");
      setContactId(data.contact_id);
      setDocId((data.invoice_id ?? data.bill_id) ?? ON_ACCOUNT);
      setAccountId(data.account_id ?? "");
      setMode(data.mode as "cash" | "bank" | "other");
      setPaymentDate(data.payment_date);
      setAmount(String(data.amount));
      setReference(data.reference ?? "");
      setNotes(data.notes ?? "");
      setLoadingEdit(false);
    })();
  }, [isEdit, editId, navigate]);

  // Load open documents for chosen contact (in edit mode also include the currently linked doc)
  useEffect(() => {
    if (!contactId) { setDocs([]); if (!isEdit) setDocId(""); return; }
    (async () => {
      let opts: DocOption[] = [];
      const currentDocId = isEdit ? (docId || null) : null;
      if (direction === "in") {
        const { data, error } = await supabase
          .from("invoices")
          .select("id, invoice_number, invoice_date, total, paid_amount, status")
          .eq("contact_id", contactId)
          .or(`status.in.(open,partial)${currentDocId ? `,id.eq.${currentDocId}` : ""}`)
          .order("invoice_date", { ascending: false });
        if (error) { toast.error(error.message); return; }
        opts = (data ?? []).map((d) => ({
          id: d.id,
          number: d.invoice_number,
          date: d.invoice_date,
          total: Number(d.total),
          paid_amount: Number(d.paid_amount),
          balance: Number(d.total) - Number(d.paid_amount),
        }));
      } else {
        const { data, error } = await supabase
          .from("bills")
          .select("id, bill_number, bill_date, total, paid_amount, status")
          .eq("contact_id", contactId)
          .or(`status.in.(open,partial)${currentDocId ? `,id.eq.${currentDocId}` : ""}`)
          .order("bill_date", { ascending: false });
        if (error) { toast.error(error.message); return; }
        opts = (data ?? []).map((d) => ({
          id: d.id,
          number: d.bill_number,
          date: d.bill_date,
          total: Number(d.total),
          paid_amount: Number(d.paid_amount),
          balance: Number(d.total) - Number(d.paid_amount),
        }));
      }
      setDocs(opts);
      if (!isEdit && opts.length === 1) {
        setDocId(opts[0].id);
        setAmount(String(opts[0].balance));
      }
      // Capture the original doc balance (before this payment) for edit validation
      if (isEdit && currentDocId && originalDocBalance === null) {
        const d = opts.find((x) => x.id === currentDocId);
        if (d) {
          // The doc's balance currently excludes the original amount (it was reduced by it).
          // So available balance for the edited amount = current balance + original amount.
          const orig = parseFloat(amount || "0") || 0;
          setOriginalDocBalance(d.balance + orig);
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactId, direction, isEdit]);

  const selectedDoc = useMemo(() => docs.find((d) => d.id === docId), [docs, docId]);

  const onPickDoc = (id: string) => {
    setDocId(id);
    if (id === ON_ACCOUNT) return;
    const d = docs.find((x) => x.id === id);
    if (d) setAmount(String(d.balance));
  };

  const isOnAccount = docId === ON_ACCOUNT;

  const totalOpenBalance = useMemo(
    () => docs.reduce((s, d) => s + Math.max(0, d.balance), 0),
    [docs]
  );

  const validate = () => {
    if (!contactId) return "Select a contact";
    if (!docId) return "Select a document or choose On account";
    if (!accountId) return "Select cash/bank account";
    const amt = parseFloat(amount || "0") || 0;
    if (amt <= 0) return "Amount must be greater than zero";
    if (isOnAccount) {
      // Overpayments are allowed — they sit as a credit (unallocated AR/AP) on the contact.
      // No upper bound check here.
    } else if (selectedDoc) {
      const isSameDoc = isEdit && originalDocBalance !== null;
      const maxAllowed = isSameDoc ? originalDocBalance! : selectedDoc.balance;
      if (amt > maxAllowed + 0.0001) return `Amount exceeds balance (${formatMoney(maxAllowed)})`;
    }
    return null;
  };

  const reverseExistingPayment = (id: string) => reversePayment(id);

  const handleSubmit = async () => {
    const err = validate();
    if (err) { toast.error(err); return; }
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not authenticated");
      if (!companyId) throw new Error("No active company");
      const amt = parseFloat(amount || "0") || 0;

      const payload = {
        user_id: u.user.id,
        company_id: companyId,
        direction,
        contact_id: contactId,
        invoice_id: direction === "in" && !isOnAccount ? docId : null,
        bill_id: direction === "out" && !isOnAccount ? docId : null,
        account_id: accountId,
        mode,
        payment_date: paymentDate,
        amount: amt,
        reference: reference || null,
        notes: notes || null,
      };

      if (isEdit && editId) {
        // Reverse old posting + balance, update record, re-post
        await reverseExistingPayment(editId);
        const { error: upErr } = await supabase.from("payments").update(payload).eq("id", editId);
        if (upErr) throw upErr;
        try {
          await postPayment(editId);
        } catch (e) {
          throw e;
        }
        toast.success("Payment updated");
        navigate("/payments");
        return;
      }

      const { data: ins, error } = await supabase.from("payments").insert(payload).select("id").single();
      if (error || !ins) throw error ?? new Error("Could not save payment");

      try {
        await postPayment(ins.id);
      } catch (e) {
        // Roll back the payment record so the user can fix and retry
        await supabase.from("payments").delete().eq("id", ins.id);
        throw e;
      }
      toast.success(direction === "in" ? "Receipt recorded" : "Payment recorded");
      navigate("/payments");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const isReceipt = direction === "in";
  const docLabel = isReceipt ? "Invoice" : "Bill";

  return (
    <>
      <PageHeader
        title={isEdit ? (isReceipt ? "Edit Receipt" : "Edit Payment") : (isReceipt ? "New Receipt" : "New Payment")}
        description={isReceipt ? "Record money received from a customer" : "Record money paid to a supplier"}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate("/payments")}><ArrowLeft className="h-4 w-4 mr-1.5" />Back</Button>
            <Button onClick={handleSubmit} disabled={saving || loadingEdit}>
              <CheckCircle2 className="h-4 w-4 mr-1.5" />{saving ? "Saving…" : isEdit ? "Update & Re-post" : "Save & Post"}
            </Button>
          </div>
        }
      />
      <div className="p-6 max-w-3xl space-y-4">
        <Card className="shadow-[var(--shadow-card)]">
          <CardContent className="p-5 space-y-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={direction} onValueChange={(v) => setDirection(v as "in" | "out")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="in">Receipt (money in, against an invoice)</SelectItem>
                  <SelectItem value="out">Payment (money out, against a bill)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{isReceipt ? "Customer *" : "Supplier *"}</Label>
                <Select value={contactId} onValueChange={(v) => { if (v === "__new_contact__") { setQuickAddContactOpen(true); return; } setContactId(v); }}>
                  <SelectTrigger><SelectValue placeholder={`Select ${isReceipt ? "customer" : "supplier"}`} /></SelectTrigger>
                  <SelectContent>
                    {contacts.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    <div className="border-t border-border mt-1 pt-1">
                      <SelectItem value="__new_contact__" className="text-primary font-medium">
                        + Create new {isReceipt ? "customer" : "supplier"}…
                      </SelectItem>
                    </div>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{docLabel} *</Label>
                <Select value={docId} onValueChange={onPickDoc} disabled={!contactId}>
                  <SelectTrigger>
                    <SelectValue placeholder={!contactId ? `Select ${isReceipt ? "customer" : "supplier"} first` : `Select ${docLabel.toLowerCase()} or On account`} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ON_ACCOUNT}>
                      On account (auto-allocate oldest first){totalOpenBalance > 0 ? ` · ${formatMoney(totalOpenBalance)} open` : ""}
                    </SelectItem>
                    {docs.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.number} — {formatDate(d.date)} · Bal {formatMoney(d.balance)}
                      </SelectItem>
                    ))}
                    {contactId && docs.length === 0 && (
                      <div className="px-3 py-2 text-sm text-muted-foreground">No open {docLabel.toLowerCase()}s.</div>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {isOnAccount ? (
              <div className="rounded-md border border-border bg-primary-muted/40 p-3 text-sm">
                <p className="text-xs text-muted-foreground mb-1">On-account allocation</p>
                <p>
                  Amount applies to the oldest open {docLabel.toLowerCase()}s first. Total open balance:{" "}
                  <span className="num font-medium text-primary">{formatMoney(totalOpenBalance)}</span>.
                  {parseFloat(amount || "0") > totalOpenBalance + 0.0001 && (
                    <> Excess of{" "}
                      <span className="num font-medium text-success">
                        {formatMoney(parseFloat(amount || "0") - totalOpenBalance)}
                      </span>{" "}
                      will sit as a credit on this contact's account.
                    </>
                  )}
                </p>
              </div>
            ) : selectedDoc && (
              <div className="rounded-md border border-border bg-muted/40 p-3 text-sm grid grid-cols-3 gap-3">
                <div><p className="text-xs text-muted-foreground">Total</p><p className="num font-medium">{formatMoney(selectedDoc.total)}</p></div>
                <div><p className="text-xs text-muted-foreground">Paid</p><p className="num font-medium">{formatMoney(selectedDoc.paid_amount)}</p></div>
                <div><p className="text-xs text-muted-foreground">Balance</p><p className="num font-medium text-primary">{formatMoney(selectedDoc.balance)}</p></div>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Date *</Label>
                <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Cash / Bank account *</Label>
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Mode</Label>
                <Select value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="bank">Bank transfer</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Amount *</Label>
                <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Reference</Label>
                <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Cheque #, txn id…" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </CardContent>
        </Card>
      </div>
      <QuickAddContactDialog
        open={quickAddContactOpen}
        onOpenChange={setQuickAddContactOpen}
        onCreated={handleContactCreated}
        defaultType={isReceipt ? "customer" : "supplier"}
        lockType
      />
    </>
  );
};

export default PaymentForm;
