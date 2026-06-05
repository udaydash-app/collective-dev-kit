import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2, Target, TrendingUp, Calculator, Calendar } from "lucide-react";
import { FileSpreadsheet, FileDown } from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { addPdfHeader, fetchCompanySettings } from "@/lib/pdfBranding";
import { ReturnToPOSButton } from "@/components/layout/ReturnToPOSButton";
import { formatCurrency } from "@/lib/utils";
import { getPosAdminSession } from "@/db/queries/accounting";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";

interface ExpenseRow {
  id: string;
  label: string;
  amount: number;
}

type Mode = "current" | "simulated";

export default function SalesTarget() {
  const [expenses, setExpenses] = useState<ExpenseRow[]>([
    { id: crypto.randomUUID(), label: "Rent", amount: 0 },
    { id: crypto.randomUUID(), label: "Salaries", amount: 0 },
    { id: crypto.randomUUID(), label: "Utilities", amount: 0 },
  ]);
  const [mode, setMode] = useState<Mode>("current");
  const [simulatedMarkup, setSimulatedMarkup] = useState<number>(50);

  // Past 3 months window
  const now = new Date();
  const startDate = format(startOfMonth(subMonths(now, 3)), "yyyy-MM-dd");
  const endDate = format(endOfMonth(subMonths(now, 1)), "yyyy-MM-dd");

  const { data: history, isLoading } = useQuery({
    queryKey: ["sales-target-history", startDate, endDate],
    queryFn: async () => {
      const build = (total_revenue: number, total_cogs: number) => {
        const gross_profit = total_revenue - total_cogs;
        const margin_pct = total_revenue > 0 ? (gross_profit / total_revenue) * 100 : 0;
        return {
          total_revenue,
          total_cogs,
          gross_profit,
          margin_pct,
          avg_monthly_revenue: total_revenue / 3,
          avg_monthly_profit: gross_profit / 3,
        };
      };

      // Try secure RPC first (uses admin PIN session)
      const adminSession = getPosAdminSession();
      if (adminSession) {
        const { data, error } = await supabase.rpc("get_product_profit_report" as any, {
          input_pos_user_id: adminSession.posUserId,
          input_pin: adminSession.pin,
          start_ts: startDate,
          end_ts: endDate + "T23:59:59",
          store_filter: null,
          category_filter: null,
        });
        if (!error && Array.isArray(data) && data.length > 0) {
          const rows = data as any[];
          const total_revenue = rows.reduce((s, r) => s + (Number(r.total_revenue) || 0), 0);
          const total_cogs = rows.reduce((s, r) => s + (Number(r.total_cogs) || 0), 0);
          return build(total_revenue, total_cogs);
        }
        if (error) console.warn("[sales-target] RPC failed, falling back", error);
      }

      // Fallback: compute directly from pos_transactions + products
      const { data: txs, error: txErr } = await supabase
        .from("pos_transactions")
        .select("items, total, created_at")
        .gte("created_at", startDate)
        .lte("created_at", endDate + "T23:59:59");
      if (txErr) throw txErr;

      const productIds = new Set<string>();
      const lineItems: { pid: string; qty: number; price: number; discount: number }[] = [];
      const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      for (const t of (txs || []) as any[]) {
        const items = Array.isArray(t.items) ? t.items : [];
        for (const it of items) {
          const pid = it.productId || it.product_id || it.id;
          if (!pid || !uuidRe.test(pid)) continue;
          const qty = Math.abs(Number(it.quantity) || 0);
          const price = Number(it.customPrice ?? it.price ?? it.unit_price ?? 0);
          const discount = Number(it.itemDiscount ?? it.discount ?? 0);
          if (qty <= 0) continue;
          productIds.add(pid);
          lineItems.push({ pid, qty, price, discount });
        }
      }

      const total_revenue = lineItems.reduce(
        (s, l) => s + Math.max(l.price - l.discount, 0) * l.qty,
        0
      );

      if (productIds.size === 0) return build(total_revenue, 0);

      const ids = Array.from(productIds);
      const costMap = new Map<string, number>();
      const CHUNK = 200;
      for (let i = 0; i < ids.length; i += CHUNK) {
        const slice = ids.slice(i, i + CHUNK);
        const { data: prods, error: pErr } = await supabase
          .from("products")
          .select("id, cost_price, local_charges")
          .in("id", slice);
        if (pErr) throw pErr;
        for (const p of (prods || []) as any[]) {
          costMap.set(p.id, (Number(p.cost_price) || 0) + (Number(p.local_charges) || 0));
        }
      }

      const total_cogs = lineItems.reduce(
        (s, l) => s + (costMap.get(l.pid) || 0) * l.qty,
        0
      );

      return build(total_revenue, total_cogs);
    },
  });

  const totalExpenses = useMemo(
    () => expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0),
    [expenses]
  );
  const marginTarget = totalExpenses * 2; // double the expenses

  // Effective margin ratio = gross_profit / revenue
  const effectiveMarginRatio = useMemo(() => {
    if (mode === "simulated") {
      const p = simulatedMarkup / 100;
      // sale = cost*(1+p); margin/sale = p/(1+p)
      return p / (1 + p);
    }
    if (history && history.margin_pct > 0) return history.margin_pct / 100;
    return 0;
  }, [mode, simulatedMarkup, history]);

  const requiredRevenue = effectiveMarginRatio > 0 ? marginTarget / effectiveMarginRatio : 0;
  const dailyTarget = requiredRevenue / 30;

  const avgMonthly = history?.avg_monthly_revenue ?? 0;
  const gapVsAvg = requiredRevenue - avgMonthly;
  const gapPct = avgMonthly > 0 ? (gapVsAvg / avgMonthly) * 100 : 0;

  const updateExpense = (id: string, patch: Partial<ExpenseRow>) =>
    setExpenses((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const addExpense = () =>
    setExpenses((rows) => [...rows, { id: crypto.randomUUID(), label: "", amount: 0 }]);
  const removeExpense = (id: string) =>
    setExpenses((rows) => rows.filter((r) => r.id !== id));

  const periodLabel = `${format(new Date(startDate), "dd/MM/yyyy")} to ${format(new Date(endDate), "dd/MM/yyyy")}`;
  const modeLabel = mode === "current" ? "Current sale prices (past 3-month margin)" : `Simulated markup ${simulatedMarkup}% on cost`;

  const buildRows = (): (string | number)[][] => {
    const rows: (string | number)[][] = [];
    rows.push(["Monthly Expenses", ""]);
    expenses.forEach((e) => rows.push([e.label || "(unnamed)", e.amount || 0]));
    rows.push(["Total monthly expenses", totalExpenses]);
    rows.push(["Margin target (2× expenses)", marginTarget]);
    rows.push([]);
    rows.push(["Margin Source", modeLabel]);
    rows.push(["Effective margin ratio", `${(effectiveMarginRatio * 100).toFixed(2)}%`]);
    rows.push([]);
    rows.push(["Required monthly sales", requiredRevenue]);
    rows.push(["Required daily sales (÷30)", dailyTarget]);
    rows.push(["Expected gross profit", marginTarget]);
    rows.push([]);
    rows.push([`Past 3 months (${periodLabel})`, ""]);
    if (history) {
      rows.push(["Total revenue", history.total_revenue]);
      rows.push(["Gross profit", history.gross_profit]);
      rows.push(["Past margin %", `${history.margin_pct.toFixed(2)}%`]);
      rows.push(["Avg monthly revenue", history.avg_monthly_revenue]);
      rows.push(["Avg monthly profit", history.avg_monthly_profit]);
      rows.push(["Required vs avg monthly", gapVsAvg]);
      rows.push(["Gap %", `${gapPct.toFixed(1)}%`]);
    }
    return rows;
  };

  const exportExcel = () => {
    const data: (string | number)[][] = [
      ["SALES TARGET SIMULATION"],
      [`Generated: ${format(new Date(), "dd/MM/yyyy HH:mm")}`],
      [],
      ...buildRows(),
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sales Target");
    XLSX.writeFile(wb, `Sales_Target_${format(new Date(), "yyyyMMdd_HHmm")}.xlsx`);
  };

  const exportPDF = async () => {
    const doc = new jsPDF();
    const settings = await fetchCompanySettings();
    let yPos = await addPdfHeader(doc, settings);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Sales Target Simulation", 105, yPos, { align: "center" });
    yPos += 7;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Generated: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 105, yPos, { align: "center" });
    yPos += 6;

    autoTable(doc, {
      startY: yPos,
      head: [["Monthly Expenses", "Amount"]],
      body: [
        ...expenses.map((e) => [e.label || "(unnamed)", formatCurrency(e.amount || 0)]),
        ["Total monthly expenses", formatCurrency(totalExpenses)],
        ["Margin target (2× expenses)", formatCurrency(marginTarget)],
      ],
      theme: "striped",
      headStyles: { fillColor: [34, 197, 94] },
      styles: { fontSize: 9 },
    });

    autoTable(doc, {
      head: [["Required Sales", "Value"]],
      body: [
        ["Margin source", modeLabel],
        ["Effective margin ratio", `${(effectiveMarginRatio * 100).toFixed(2)}%`],
        ["Required monthly sales", formatCurrency(requiredRevenue)],
        ["Required daily sales (÷30)", formatCurrency(dailyTarget)],
        ["Expected gross profit", formatCurrency(marginTarget)],
      ],
      theme: "striped",
      headStyles: { fillColor: [34, 197, 94] },
      styles: { fontSize: 9 },
    });

    if (history) {
      autoTable(doc, {
        head: [[`Past 3 months (${periodLabel})`, "Value"]],
        body: [
          ["Total revenue", formatCurrency(history.total_revenue)],
          ["Gross profit", formatCurrency(history.gross_profit)],
          ["Past margin %", `${history.margin_pct.toFixed(2)}%`],
          ["Avg monthly revenue", formatCurrency(history.avg_monthly_revenue)],
          ["Avg monthly profit", formatCurrency(history.avg_monthly_profit)],
          ["Required vs avg monthly", `${gapVsAvg > 0 ? "+" : ""}${formatCurrency(gapVsAvg)} (${gapPct > 0 ? "+" : ""}${gapPct.toFixed(1)}%)`],
        ],
        theme: "striped",
        headStyles: { fillColor: [34, 197, 94] },
        styles: { fontSize: 9 },
      });
    }

    doc.save(`Sales_Target_${format(new Date(), "yyyyMMdd_HHmm")}.pdf`);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header />
      <ReturnToPOSButton />
      <div className="container mx-auto px-4 py-6 max-w-6xl space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Target className="h-7 w-7 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Sales Target</h1>
              <p className="text-sm text-muted-foreground">
                Enter monthly expenses — target margin is set to 2× expenses, then we compute required sales.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportExcel}>
              <FileSpreadsheet className="h-4 w-4 mr-2" /> Excel
            </Button>
            <Button variant="outline" size="sm" onClick={exportPDF}>
              <FileDown className="h-4 w-4 mr-2" /> PDF
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Expenses */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" /> Monthly Expenses
              </CardTitle>
              <CardDescription>Add every recurring monthly cost.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {expenses.map((row) => (
                <div key={row.id} className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Input
                      placeholder="Expense name"
                      value={row.label}
                      onChange={(e) => updateExpense(row.id, { label: e.target.value })}
                    />
                  </div>
                  <div className="w-40">
                    <Input
                      type="number"
                      inputMode="decimal"
                      placeholder="0"
                      value={row.amount || ""}
                      onChange={(e) => updateExpense(row.id, { amount: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeExpense(row.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addExpense} className="w-full">
                <Plus className="h-4 w-4 mr-1" /> Add expense
              </Button>
              <Separator />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total monthly expenses</span>
                <span className="font-semibold">{formatCurrency(totalExpenses)}</span>
              </div>
              <div className="flex justify-between text-base">
                <span className="text-muted-foreground">Margin target (2× expenses)</span>
                <span className="font-bold text-primary">{formatCurrency(marginTarget)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Margin source */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" /> Margin Source
              </CardTitle>
              <CardDescription>How should we estimate margin per sale?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <RadioGroup value={mode} onValueChange={(v) => setMode(v as Mode)}>
                <div className="flex items-start gap-2 border rounded-lg p-3">
                  <RadioGroupItem value="current" id="m-current" className="mt-1" />
                  <Label htmlFor="m-current" className="flex-1 cursor-pointer">
                    <div className="font-medium">Current sale prices</div>
                    <div className="text-xs text-muted-foreground">
                      Uses the actual margin % from the last 3 months of sales.
                    </div>
                    {history && (
                      <div className="text-xs mt-1">
                        Past margin: <span className="font-semibold">{history.margin_pct.toFixed(2)}%</span>
                      </div>
                    )}
                  </Label>
                </div>
                <div className="flex items-start gap-2 border rounded-lg p-3">
                  <RadioGroupItem value="simulated" id="m-sim" className="mt-1" />
                  <Label htmlFor="m-sim" className="flex-1 cursor-pointer">
                    <div className="font-medium">Simulated markup</div>
                    <div className="text-xs text-muted-foreground">
                      sale = effective_cost × (1 + %). Margin ratio = p / (1 + p).
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <Input
                        type="number"
                        value={simulatedMarkup}
                        onChange={(e) => setSimulatedMarkup(parseFloat(e.target.value) || 0)}
                        className="w-24"
                        disabled={mode !== "simulated"}
                      />
                      <span className="text-sm text-muted-foreground">% markup on cost</span>
                    </div>
                  </Label>
                </div>
              </RadioGroup>
              <Separator />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Effective margin ratio</span>
                <span className="font-semibold">{(effectiveMarginRatio * 100).toFixed(2)}%</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Result */}
        <Card className="border-primary/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" /> Required Sales
            </CardTitle>
            <CardDescription>
              Sales volume needed so gross profit covers 2× your monthly expenses.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {marginTarget <= 0 ? (
              <p className="text-sm text-muted-foreground">Add at least one expense to compute the target.</p>
            ) : effectiveMarginRatio <= 0 ? (
              <p className="text-sm text-destructive">
                Margin ratio is 0%. {mode === "current"
                  ? "No past sales found — switch to Simulated markup."
                  : "Increase the simulated markup %."}
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-3">
                <Stat label="Required monthly sales" value={formatCurrency(requiredRevenue)} highlight />
                <Stat label="Required daily sales (÷30)" value={formatCurrency(dailyTarget)} />
                <Stat label="Expected gross profit" value={formatCurrency(marginTarget)} />
              </div>
            )}
          </CardContent>
        </Card>

        {/* History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" /> Past 3 months
            </CardTitle>
            <CardDescription>
              {format(new Date(startDate), "dd/MM/yyyy")} → {format(new Date(endDate), "dd/MM/yyyy")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : !history ? (
              <p className="text-sm text-muted-foreground">No history available.</p>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-4">
                  <Stat label="Total revenue" value={formatCurrency(history.total_revenue)} />
                  <Stat label="Gross profit" value={formatCurrency(history.gross_profit)} />
                  <Stat label="Avg monthly revenue" value={formatCurrency(history.avg_monthly_revenue)} />
                  <Stat label="Avg monthly profit" value={formatCurrency(history.avg_monthly_profit)} />
                </div>
                {marginTarget > 0 && effectiveMarginRatio > 0 && (
                  <div className="p-4 rounded-lg bg-muted/40 text-sm space-y-1">
                    <div className="flex justify-between">
                      <span>Required vs avg monthly sales</span>
                      <span className={gapVsAvg > 0 ? "text-destructive font-semibold" : "text-emerald-600 font-semibold"}>
                        {gapVsAvg > 0 ? "+" : ""}
                        {formatCurrency(gapVsAvg)} ({gapPct > 0 ? "+" : ""}{gapPct.toFixed(1)}%)
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {gapVsAvg > 0
                        ? `You need to sell ${formatCurrency(gapVsAvg)} more per month than your 3-month average to hit the target.`
                        : `Your 3-month average already exceeds the required target by ${formatCurrency(-gapVsAvg)}.`}
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <BottomNav />
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`p-4 rounded-lg border ${highlight ? "border-primary bg-primary/5" : "bg-card"}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-lg font-bold ${highlight ? "text-primary" : ""}`}>{value}</div>
    </div>
  );
}