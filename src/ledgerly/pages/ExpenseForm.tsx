import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";
import { postExpense } from "@/lib/posting";
import { useCompany } from "@/contexts/CompanyContext";

interface Account { id: string; code: string | null; name: string; type: string; }
interface Contact { id: string; name: string; }

const todayISO = () => new Date().toISOString().slice(0, 10);

const ExpenseForm = () => {
  const navigate = useNavigate();
  const { companyId } = useCompany();
  const [expenseAccounts, setExpenseAccounts] = useState<Account[]>([]);
  const [paidFromAccounts, setPaidFromAccounts] = useState<Account[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);

  const [expenseDate, setExpenseDate] = useState(todayISO());
  const [categoryId, setCategoryId] = useState("");
  const [paidFromId, setPaidFromId] = useState("");
  const [mode, setMode] = useState<"cash" | "bank" | "other">("cash");
  const [contactId, setContactId] = useState("");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!companyId) return;
    (async () => {
      const [a, c] = await Promise.all([
        supabase.from("accounts").select("id, code, name, type")
          .eq("company_id", companyId).eq("is_active", true).order("code", { nullsFirst: false }).order("name"),
        supabase.from("contacts").select("id, name").eq("company_id", companyId).eq("is_active", true).order("name"),
      ]);
      if (a.error) toast.error(a.error.message);
      if (c.error) toast.error(c.error.message);
      const all = (a.data ?? []) as Account[];
      setExpenseAccounts(all.filter((x) => x.type === "expense"));
      // Paid-from: cash & bank accounts (codes 1000, 1010) plus any other asset accounts
      setPaidFromAccounts(all.filter((x) => x.type === "asset" && (x.code === "1000" || x.code === "1010" || x.name.toLowerCase().includes("cash") || x.name.toLowerCase().includes("bank"))));
      setContacts((c.data ?? []) as Contact[]);
    })();
  }, [companyId]);

  // Auto-pick mode from paid-from selection
  useEffect(() => {
    const acc = paidFromAccounts.find((a) => a.id === paidFromId);
    if (!acc) return;
    if (acc.code === "1000" || acc.name.toLowerCase().includes("cash")) setMode("cash");
    else if (acc.code === "1010" || acc.name.toLowerCase().includes("bank")) setMode("bank");
  }, [paidFromId, paidFromAccounts]);

  const handleSave = async () => {
    const amt = parseFloat(amount);
    if (!expenseDate) { toast.error("Date is required"); return; }
    if (!categoryId) { toast.error("Pick an expense category"); return; }
    if (!paidFromId) { toast.error("Pick a paid-from account"); return; }
    if (!(amt > 0)) { toast.error("Amount must be greater than zero"); return; }

    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not authenticated");
      if (!companyId) throw new Error("No active company");

      const { data: created, error } = await supabase.from("expenses").insert({
        user_id: u.user.id,
        company_id: companyId,
        expense_date: expenseDate,
        category_account_id: categoryId,
        paid_from_account_id: paidFromId,
        contact_id: contactId || null,
        mode,
        amount: amt,
        reference: reference || null,
        notes: notes || null,
      }).select("id").single();
      if (error || !created) throw error ?? new Error("Failed to create expense");

      await postExpense(created.id);
      toast.success("Expense recorded and posted");
      navigate("/expenses");
    } catch (e: any) {
      toast.error(e?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Record Expense"
        description="Posts Dr Expense / Cr Cash-or-Bank automatically"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/expenses")}>
              <ArrowLeft className="h-4 w-4 mr-2" />Back
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />{saving ? "Saving…" : "Save & Post"}
            </Button>
          </div>
        }
      />
      <div className="p-6">
        <Card className="shadow-[var(--shadow-card)] max-w-3xl">
          <CardContent className="p-6 grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input type="number" step="0.01" min="0" className="num" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger><SelectValue placeholder="Select expense category" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {expenseAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      <span className="text-muted-foreground num mr-2">{a.code ?? "—"}</span>{a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Paid from</Label>
              <Select value={paidFromId} onValueChange={setPaidFromId}>
                <SelectTrigger><SelectValue placeholder="Cash / Bank account" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {paidFromAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      <span className="text-muted-foreground num mr-2">{a.code ?? "—"}</span>{a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Mode</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as "cash" | "bank" | "other")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank">Bank</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Paid to (optional)</Label>
              <Select value={contactId || "none"} onValueChange={(v) => setContactId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="none">— None —</SelectItem>
                  {contacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Reference</Label>
              <Input value={reference} placeholder="e.g. Receipt #123" onChange={(e) => setReference(e.target.value)} />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Notes</Label>
              <Textarea rows={3} value={notes} placeholder="What was this expense for?" onChange={(e) => setNotes(e.target.value)} />
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default ExpenseForm;
