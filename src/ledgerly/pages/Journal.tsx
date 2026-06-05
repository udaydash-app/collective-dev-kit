import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, BookMarked } from "lucide-react";
import { toast } from "sonner";
import { formatMoney, formatDate } from "@/lib/format";
import { useCompany } from "@/contexts/CompanyContext";

interface JournalRow {
  id: string;
  entry_date: string;
  reference: string | null;
  narration: string | null;
  source_type: string | null;
  total_debit: number;
  line_count: number;
}

const Journal = () => {
  const { companyId } = useCompany();
  const [rows, setRows] = useState<JournalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!companyId) return;
    (async () => {
      setLoading(true);
      const { data: entries, error } = await supabase
        .from("journal_entries")
        .select("id, entry_date, reference, narration, source_type")
        .eq("company_id", companyId)
        .order("entry_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) { toast.error(error.message); setLoading(false); return; }

      const ids = (entries ?? []).map((e) => e.id);
      const totals: Record<string, { d: number; n: number }> = {};
      if (ids.length) {
        const { data: lines } = await supabase
          .from("journal_lines").select("entry_id, debit").in("entry_id", ids);
        (lines ?? []).forEach((l: any) => {
          const cur = totals[l.entry_id] ?? { d: 0, n: 0 };
          cur.d += Number(l.debit); cur.n += 1;
          totals[l.entry_id] = cur;
        });
      }

      setRows((entries ?? []).map((e) => ({
        ...e,
        total_debit: totals[e.id]?.d ?? 0,
        line_count: totals[e.id]?.n ?? 0,
      })));
      setLoading(false);
    })();
  }, [companyId]);

  const filtered = rows.filter((r) =>
    !q || r.reference?.toLowerCase().includes(q.toLowerCase()) || r.narration?.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <>
      <PageHeader
        title="Journal Entries"
        description="Manual double-entry adjustments and all posted entries"
        actions={
          <Button asChild size="sm">
            <Link to="/journal/new"><Plus className="h-4 w-4 mr-2" />New Journal Entry</Link>
          </Button>
        }
      />
      <div className="p-6 space-y-4">
        <Card className="shadow-[var(--shadow-card)] p-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search reference or narration…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </Card>

        <Card className="shadow-[var(--shadow-card)]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Date</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Narration</TableHead>
                <TableHead className="w-28">Source</TableHead>
                <TableHead className="w-20 text-center">Lines</TableHead>
                <TableHead className="text-right w-36">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-10">Loading…</TableCell></TableRow>
              )}
              {!loading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    <BookMarked className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">No journal entries yet.</p>
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((r) => {
                const isManual = !r.source_type || r.source_type === "manual";
                return (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(r.entry_date)}</TableCell>
                    <TableCell className="font-medium">
                      {isManual ? (
                        <Link to={`/journal/${r.id}`} className="text-primary hover:underline">
                          {r.reference ?? "—"}
                        </Link>
                      ) : (r.reference ?? "—")}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-md truncate">{r.narration ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] capitalize">{r.source_type ?? "manual"}</Badge>
                    </TableCell>
                    <TableCell className="text-center text-sm num">{r.line_count}</TableCell>
                    <TableCell className="text-right num font-medium">{formatMoney(r.total_debit)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      </div>
    </>
  );
};

export default Journal;
