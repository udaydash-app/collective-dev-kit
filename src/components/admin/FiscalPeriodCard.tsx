import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CalendarClock, RefreshCw, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useFiscalPeriod } from "@/contexts/FiscalPeriodContext";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { formatDate } from "@/lib/utils";

export function FiscalPeriodCard() {
  const { period, setPeriod, incorporationDate, effectiveFrom, effectiveTo, refresh } = useFiscalPeriod();
  const qc = useQueryClient();
  const [incorp, setIncorp] = useState(incorporationDate);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => setIncorp(incorporationDate), [incorporationDate]);

  // F12 opens focus on the period selector
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F12") {
        e.preventDefault();
        const el = document.getElementById("fiscal-period-select");
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
        (el as HTMLElement | null)?.click();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function saveIncorpAndPeriod(newPeriod?: "current" | "before", newIncorp?: string) {
    setSaving(true);
    try {
      const patch: any = {};
      if (newIncorp) patch.incorporation_date = newIncorp;
      if (newPeriod) patch.active_period = newPeriod;
      const { data: existing } = await (supabase as any).from("settings").select("id").limit(1).maybeSingle();
      if (existing?.id) {
        await (supabase as any).from("settings").update(patch).eq("id", existing.id);
      } else {
        await (supabase as any).from("settings").insert(patch);
      }
      if (newPeriod) setPeriod(newPeriod);
      await refresh();
      qc.invalidateQueries();
      toast.success("Fiscal period updated");
    } catch (e: any) {
      toast.error(e?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function generateOpening() {
    if (!confirm(`This will (re)create the opening balance journal entry as of the day before ${formatDate(incorp)}. Continue?`)) return;
    setGenerating(true);
    try {
      const cutoff = new Date(incorp + "T00:00:00");
      cutoff.setDate(cutoff.getDate() - 1);
      const cutoffISO = cutoff.toISOString().slice(0, 10);
      const { data, error } = await (supabase as any).rpc("generate_opening_balances", { p_cutoff: cutoffISO });
      if (error) throw error;
      const lines = data?.[0]?.lines_created ?? 0;
      toast.success(`Opening balance created (${lines} lines)`);
      qc.invalidateQueries();
    } catch (e: any) {
      toast.error(e?.message || "Failed to generate opening balance");
    } finally {
      setGenerating(false);
    }
  }

  const rangeLabel =
    period === "current"
      ? `From ${formatDate(effectiveFrom!)} onward`
      : `Up to ${formatDate(effectiveTo!)}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="h-5 w-5" />
          Fiscal Period
          <Badge variant="secondary" className="ml-2">Press F12</Badge>
        </CardTitle>
        <CardDescription>
          Controls the date range used by General Ledger, Trial Balance, P&amp;L, Balance Sheet and stock reports across the app.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="fiscal-period-select">Active period</Label>
            <Select
              value={period}
              onValueChange={(v) => saveIncorpAndPeriod(v as "current" | "before")}
            >
              <SelectTrigger id="fiscal-period-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="before">Before Incorporation</SelectItem>
                <SelectItem value="current">Current</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{rangeLabel}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="incorp-date">Start of business (incorporation date)</Label>
            <div className="flex gap-2">
              <Input
                id="incorp-date"
                type="date"
                value={incorp}
                onChange={(e) => setIncorp(e.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                disabled={saving || incorp === incorporationDate}
                onClick={() => saveIncorpAndPeriod(undefined, incorp)}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </Button>
            </div>
          </div>
        </div>
        <div className="pt-2 border-t">
          <Button type="button" variant="secondary" onClick={generateOpening} disabled={generating}>
            {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Generate opening balances
          </Button>
          <p className="text-[11px] text-muted-foreground mt-2">
            Sums all posted entries dated on/before the day prior to the incorporation date and posts a single balanced
            opening journal entry. Safe to re-run — the previous opening entry is replaced.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}