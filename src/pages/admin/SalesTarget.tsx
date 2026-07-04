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
import { usePriceMasking } from "@/hooks/usePriceMasking";
import { pickItemUnitPrice } from "@/lib/priceMasking";

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
  // F12 flips revenue calculations between masked and real ledger.
  const { revealRealPrice, maskingEnabled } = usePriceMasking();
  const isRealLedger = revealRealPrice && maskingEnabled;

  // Past 3 months window
  const now = new Date();
  const startDate = format(startOfMonth(subMonths(now, 3)), "yyyy-MM-dd");
  const endDate = format(endOfMonth(subMonths(now, 1)), "yyyy-MM-dd");

  const { data: history, isLoading } = useQuery({
    queryKey: ["sales-target-history", startDate, endDate, isRealLedger],
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
      const pageSize = 1000;
      const txs: any[] = [];
      let from = 0;
      while (true) {
        const { data, error: txErr } = await supabase
          .from("pos_transactions")
          .select("items, total, created_at, id")
          .gte("created_at", startDate)
          .lte("created_at", endDate + "T23:59:59")
          .order("created_at", { ascending: true })
          .order("id", { ascending: true })
          .range(from, from + pageSize - 1);
        if (txErr) throw txErr;
        if (!data || data.length === 0) break;
        txs.push(...data);
        if (data.length < pageSize) break;
        from += pageSize;
      }

      const productIds = new Set<string>();
      const lineItems: { pid: string; qty: number; price: number; discount: number }[] = [];
      const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      for (const t of (txs || []) as any[]) {
        const items = Array.isArray(t.items) ? t.items : [];
        for (const it of items) {
          const pid = it.productId || it.product_id || it.id;
          if (!pid || !uuidRe.test(pid)) continue;
          const qty = Math.abs(Number(it.quantity) || 0);
          const price = pickItemUnitPrice(it, isRealLedger);
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

  // Round to whole FCFA (no decimals) – matches in-app display
  const r0 = (n: number) => Math.round(Number(n) || 0);

  const exportExcel = () => {
    type Cell = { v: string | number; t?: "s" | "n"; z?: string; bold?: boolean };
    const FMT = '#,##0" FCFA"';
    const S = (v: string, bold = false): Cell => ({ v, t: "s", bold });
    const N = (v: number, bold = false): Cell => ({ v: r0(v), t: "n", z: FMT, bold });
    const P = (v: number, bold = false): Cell => ({ v: `${v.toFixed(2)}%`, t: "s", bold });

    const matrix: Cell[][] = [];
    matrix.push([S("SALES TARGET SIMULATION", true)]);
    matrix.push([S(`Generated: ${format(new Date(), "dd/MM/yyyy HH:mm")}`)]);
    matrix.push([S(`Period analysed: ${periodLabel}`)]);
    matrix.push([]);

    matrix.push([S("MONTHLY EXPENSES", true), S("AMOUNT", true)]);
    expenses.forEach((e) => matrix.push([S(e.label || "(unnamed)"), N(e.amount || 0)]));
    matrix.push([S("Total monthly expenses", true), N(totalExpenses, true)]);
    matrix.push([S("Margin target (2× expenses)", true), N(marginTarget, true)]);
    matrix.push([]);

    matrix.push([S("MARGIN SOURCE", true), S("", true)]);
    matrix.push([S("Mode"), S(modeLabel)]);
    matrix.push([S("Effective margin ratio"), P(effectiveMarginRatio * 100)]);
    matrix.push([]);

    matrix.push([S("REQUIRED SALES", true), S("", true)]);
    matrix.push([S("Required monthly sales"), N(requiredRevenue, true)]);
    matrix.push([S("Required daily sales (÷30)"), N(dailyTarget)]);
    matrix.push([S("Expected gross profit"), N(marginTarget)]);
    matrix.push([]);

    if (history) {
      matrix.push([S(`PAST 3 MONTHS (${periodLabel})`, true), S("", true)]);
      matrix.push([S("Total revenue"), N(history.total_revenue)]);
      matrix.push([S("Gross profit"), N(history.gross_profit)]);
      matrix.push([S("Past margin %"), P(history.margin_pct)]);
      matrix.push([S("Avg monthly revenue"), N(history.avg_monthly_revenue)]);
      matrix.push([S("Avg monthly profit"), N(history.avg_monthly_profit)]);
      matrix.push([S("Required vs avg monthly"), N(gapVsAvg)]);
      matrix.push([S("Gap %"), S(`${gapPct > 0 ? "+" : ""}${gapPct.toFixed(1)}%`)]);
    }

    const ws: XLSX.WorkSheet = {};
    let maxCol = 0;
    matrix.forEach((row, r) => {
      row.forEach((cell, c) => {
        if (!cell) return;
        const addr = XLSX.utils.encode_cell({ r, c });
        const out: any = { v: cell.v, t: cell.t || "s" };
        if (cell.z) out.z = cell.z;
        if (cell.bold) out.s = { font: { bold: true } };
        ws[addr] = out;
        if (c > maxCol) maxCol = c;
      });
    });
    ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: matrix.length - 1, c: Math.max(maxCol, 1) } });
    ws["!cols"] = [{ wch: 38 }, { wch: 22 }];

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
    yPos += 5;
    doc.setFontSize(9);
    doc.setTextColor(110);
    doc.text(`Period analysed: ${periodLabel}`, 105, yPos, { align: "center" });
    doc.setTextColor(0);
    yPos += 6;

    // jsPDF's default font doesn't render narrow/non-breaking spaces correctly,
    // so normalize them to regular spaces for the PDF output.
    const fc = (n: number) =>
      formatCurrency(r0(n)).replace(/[\u00A0\u202F\u2009]/g, " ");
    const tableStyle = {
      theme: "grid" as const,
      headStyles: { fillColor: [34, 197, 94] as [number, number, number], textColor: 255, fontStyle: "bold" as const },
      styles: { fontSize: 9, cellPadding: 2.5 },
      columnStyles: { 1: { halign: "right" as const, cellWidth: 55 } },
      margin: { left: 14, right: 14 },
    };

    // Executive summary
    autoTable(doc, {
      ...tableStyle,
      startY: yPos,
      head: [["Executive Summary", "Value"]],
      body: [
        ["Total monthly expenses", fc(totalExpenses)],
        ["Margin target (2× expenses)", fc(marginTarget)],
        ["Effective margin ratio", `${(effectiveMarginRatio * 100).toFixed(2)}%`],
        ["Required monthly sales", fc(requiredRevenue)],
        ["Required daily sales", fc(dailyTarget)],
      ],
      headStyles: { ...tableStyle.headStyles, fillColor: [30, 41, 59] },
    });

    autoTable(doc, {
      ...tableStyle,
      head: [["Monthly Expenses", "Amount"]],
      body: [
        ...expenses.map((e) => [e.label || "(unnamed)", fc(e.amount || 0)]),
        [{ content: "Total monthly expenses", styles: { fontStyle: "bold" } }, { content: fc(totalExpenses), styles: { fontStyle: "bold", halign: "right" } }],
        [{ content: "Margin target (2× expenses)", styles: { fontStyle: "bold" } }, { content: fc(marginTarget), styles: { fontStyle: "bold", halign: "right" } }],
      ],
    });

    autoTable(doc, {
      ...tableStyle,
      head: [["Required Sales", "Value"]],
      body: [
        ["Margin source", modeLabel],
        ["Effective margin ratio", `${(effectiveMarginRatio * 100).toFixed(2)}%`],
        [{ content: "Required monthly sales", styles: { fontStyle: "bold" } }, { content: fc(requiredRevenue), styles: { fontStyle: "bold", halign: "right" } }],
        ["Required daily sales (÷30)", fc(dailyTarget)],
        ["Expected gross profit", fc(marginTarget)],
      ],
    });

    if (history) {
      autoTable(doc, {
        ...tableStyle,
        head: [[`Past 3 months (${periodLabel})`, "Value"]],
        body: [
          ["Total revenue", fc(history.total_revenue)],
          ["Gross profit", fc(history.gross_profit)],
          ["Past margin %", `${history.margin_pct.toFixed(2)}%`],
          ["Avg monthly revenue", fc(history.avg_monthly_revenue)],
          ["Avg monthly profit", fc(history.avg_monthly_profit)],
          ["Required vs avg monthly", `${gapVsAvg > 0 ? "+" : ""}${fc(gapVsAvg)} (${gapPct > 0 ? "+" : ""}${gapPct.toFixed(1)}%)`],
        ],
      });
    }

    // Footer page numbers
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(140);
      doc.text(`Page ${i} / ${pageCount}`, 196, 290, { align: "right" });
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