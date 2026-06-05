import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Trash2, Save } from "lucide-react";
import { toast } from "sonner";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useCompany } from "@/contexts/CompanyContext";

type AccountType = "asset" | "liability" | "equity" | "income" | "expense";

interface Account {
  id: string;
  code: string | null;
  name: string;
  type: AccountType;
}

interface Contact { id: string; name: string; }

interface DraftLine {
  key: string;
  account_id: string;
  contact_id: string;
  description: string;
  debit: string;
  credit: string;
}

const newKey = () => Math.random().toString(36).slice(2, 9);
const blankLine = (): DraftLine => ({ key: newKey(), account_id: "", contact_id: "", description: "", debit: "", credit: "" });
const todayISO = () => new Date().toISOString().slice(0, 10);

const JournalForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;
  const { companyId } = useCompany();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [entryDate, setEntryDate] = useState(todayISO());
  const [reference, setReference] = useState("");
  const [narration, setNarration] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([blankLine(), blankLine()]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [readOnly, setReadOnly] = useState(false);

  useEffect(() => {
    if (!companyId) return;
    (async () => {
      const [a, c] = await Promise.all([
        supabase.from("accounts").select("id, code, name, type").eq("company_id", companyId).eq("is_active", true)
          .order("code", { nullsFirst: false }).order("name"),
        supabase.from("contacts").select("id, name").eq("company_id", companyId).eq("is_active", true).order("name"),
      ]);
      if (a.error) toast.error(a.error.message);
      if (c.error) toast.error(c.error.message);
      setAccounts((a.data ?? []) as Account[]);
      setContacts((c.data ?? []) as Contact[]);
    })();
  }, [companyId]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const { data: entry, error: eErr } = await supabase
        .from("journal_entries").select("*").eq("id", id).single();
      if (eErr || !entry) { toast.error(eErr?.message ?? "Not found"); setLoading(false); return; }
      setEntryDate(entry.entry_date);
      setReference(entry.reference ?? "");
      setNarration(entry.narration ?? "");
      setReadOnly(!!entry.source_type && entry.source_type !== "manual");

      const { data: ls } = await supabase
        .from("journal_lines")
        .select("id, account_id, contact_id, description, debit, credit")
        .eq("entry_id", id).order("created_at");
      setLines((ls ?? []).map((l: any) => ({
        key: l.id,
        account_id: l.account_id,
        contact_id: l.contact_id ?? "",
        description: l.description ?? "",
        debit: Number(l.debit) > 0 ? String(l.debit) : "",
        credit: Number(l.credit) > 0 ? String(l.credit) : "",
      })));
      setLoading(false);
    })();
  }, [id]);

  const updateLine = (key: string, patch: Partial<DraftLine>) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };

  const removeLine = (key: string) => {
    setLines((prev) => prev.length <= 2 ? prev : prev.filter((l) => l.key !== key));
  };

  const totals = useMemo(() => {
    const d = lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
    const c = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
    return { d, c, diff: d - c, balanced: Math.abs(d - c) < 0.01 && d > 0 };
  }, [lines]);

  const validate = (): string | null => {
    if (!entryDate) return "Entry date is required";
    const valid = lines.filter((l) => l.account_id && ((parseFloat(l.debit) || 0) > 0 || (parseFloat(l.credit) || 0) > 0));
    if (valid.length < 2) return "At least two lines with an account and amount are required";
    for (const l of lines) {
      const d = parseFloat(l.debit) || 0;
      const c = parseFloat(l.credit) || 0;
      if (d > 0 && c > 0) return "A line cannot have both a debit and a credit";
      if ((d > 0 || c > 0) && !l.account_id) return "Every line with an amount needs an account";
    }
    if (totals.d <= 0) return "Total debits must be greater than zero";
    if (!totals.balanced) return `Entry is unbalanced by ${formatMoney(Math.abs(totals.diff))}`;
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) { toast.error(err); return; }

    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not authenticated");
      const userId = u.user.id;
      if (!companyId) throw new Error("No active company");

      const validLines = lines.filter((l) => l.account_id && ((parseFloat(l.debit) || 0) > 0 || (parseFloat(l.credit) || 0) > 0));

      let entryId = id;
      if (isEdit && entryId) {
        const { error: uErr } = await supabase.from("journal_entries").update({
          entry_date: entryDate,
          reference: reference || null,
          narration: narration || null,
        }).eq("id", entryId);
        if (uErr) throw uErr;

        const { error: dErr } = await supabase.from("journal_lines").delete().eq("entry_id", entryId);
        if (dErr) throw dErr;
      } else {
        const { data: created, error: cErr } = await supabase.from("journal_entries").insert({
          user_id: userId,
          company_id: companyId,
          entry_date: entryDate,
          reference: reference || null,
          narration: narration || null,
          source_type: "manual",
        }).select("id").single();
        if (cErr || !created) throw cErr ?? new Error("Failed to create entry");
        entryId = created.id;
      }

      const linePayload = validLines.map((l) => ({
        user_id: userId,
        company_id: companyId,
        entry_id: entryId!,
        account_id: l.account_id,
        contact_id: l.contact_id || null,
        description: l.description || null,
        debit: parseFloat(l.debit) || 0,
        credit: parseFloat(l.credit) || 0,
      }));
      const { error: lErr } = await supabase.from("journal_lines").insert(linePayload);
      if (lErr) throw lErr;

      toast.success(isEdit ? "Journal entry updated" : "Journal entry posted");
      navigate("/journal");
    } catch (e: any) {
      toast.error(e?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-10 text-center text-sm text-muted-foreground">Loading…</div>;

  return (
    <>
      <PageHeader
        title={isEdit ? "Edit Journal Entry" : "New Journal Entry"}
        description={readOnly ? "This entry was generated by a system posting and cannot be edited here." : "Manual double-entry adjustment"}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/journal")}>
              <ArrowLeft className="h-4 w-4 mr-2" />Back
            </Button>
            {!readOnly && (
              <Button size="sm" onClick={handleSave} disabled={saving || !totals.balanced}>
                <Save className="h-4 w-4 mr-2" />{saving ? "Saving…" : (isEdit ? "Update Entry" : "Post Entry")}
              </Button>
            )}
          </div>
        }
      />
      <div className="p-6 space-y-4">
        <Card className="shadow-[var(--shadow-card)]">
          <CardContent className="p-5 grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Entry date</Label>
              <Input type="date" value={entryDate} disabled={readOnly} onChange={(e) => setEntryDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Reference</Label>
              <Input value={reference} disabled={readOnly} placeholder="e.g. ADJ-001" onChange={(e) => setReference(e.target.value)} />
            </div>
            <div className="space-y-2 md:col-span-3">
              <Label>Narration</Label>
              <Textarea rows={2} value={narration} disabled={readOnly} placeholder="Describe the purpose of this entry…" onChange={(e) => setNarration(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-[var(--shadow-card)]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead className="w-48">Contact</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right w-32">Debit</TableHead>
                <TableHead className="text-right w-32">Credit</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((l) => (
                <TableRow key={l.key}>
                  <TableCell>
                    <Select value={l.account_id} disabled={readOnly} onValueChange={(v) => updateLine(l.key, { account_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                      <SelectContent className="max-h-72">
                        {accounts.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            <span className="text-muted-foreground mr-2 num">{a.code ?? "—"}</span>{a.name}
                            <span className="ml-2 text-[10px] uppercase text-muted-foreground">{a.type}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select value={l.contact_id || "none"} disabled={readOnly} onValueChange={(v) => updateLine(l.key, { contact_id: v === "none" ? "" : v })}>
                      <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                      <SelectContent className="max-h-72">
                        <SelectItem value="none">— None —</SelectItem>
                        {contacts.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input value={l.description} disabled={readOnly} placeholder="Optional"
                      onChange={(e) => updateLine(l.key, { description: e.target.value })} />
                  </TableCell>
                  <TableCell>
                    <Input type="number" step="0.01" min="0" value={l.debit} disabled={readOnly}
                      className="text-right num"
                      onChange={(e) => updateLine(l.key, { debit: e.target.value, credit: e.target.value ? "" : l.credit })} />
                  </TableCell>
                  <TableCell>
                    <Input type="number" step="0.01" min="0" value={l.credit} disabled={readOnly}
                      className="text-right num"
                      onChange={(e) => updateLine(l.key, { credit: e.target.value, debit: e.target.value ? "" : l.debit })} />
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" disabled={readOnly || lines.length <= 2} onClick={() => removeLine(l.key)}>
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!readOnly && (
            <div className="p-3 border-t">
              <Button variant="outline" size="sm" onClick={() => setLines((prev) => [...prev, blankLine()])}>
                <Plus className="h-4 w-4 mr-2" />Add line
              </Button>
            </div>
          )}
        </Card>

        <Card className="shadow-[var(--shadow-card)]">
          <CardContent className="p-5 grid gap-4 sm:grid-cols-3 items-center">
            <div>
              <p className="text-xs text-muted-foreground">Total debits</p>
              <p className="text-lg font-semibold num">{formatMoney(totals.d)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total credits</p>
              <p className="text-lg font-semibold num">{formatMoney(totals.c)}</p>
            </div>
            <div className="flex items-center justify-end gap-3">
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Difference</p>
                <p className={cn("text-lg font-semibold num", !totals.balanced && "text-destructive")}>
                  {formatMoney(totals.diff)}
                </p>
              </div>
              <Badge variant={totals.balanced ? "default" : "destructive"}>
                {totals.balanced ? "Balanced" : "Unbalanced"}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default JournalForm;
