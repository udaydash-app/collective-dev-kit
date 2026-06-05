import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/format";
import { ArrowDownLeft, ArrowUpRight, Wallet, TrendingUp, Receipt, Package } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { format, subMonths, startOfMonth } from "date-fns";
import { useCompany } from "@/contexts/CompanyContext";

interface Kpis {
  sales: number; purchases: number; expenses: number; profit: number;
  receivable: number; payable: number; cash: number;
}

const Dashboard = () => {
  const { companyId } = useCompany();
  const [kpis, setKpis] = useState<Kpis>({ sales: 0, purchases: 0, expenses: 0, profit: 0, receivable: 0, payable: 0, cash: 0 });
  const [chart, setChart] = useState<{ month: string; Sales: number; Purchases: number; Expenses: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (companyId) load(); /* eslint-disable-next-line */ }, [companyId]);

  const load = async () => {
    if (!companyId) return;
    const [{ data: invoices }, { data: bills }, { data: expenses }] = await Promise.all([
      supabase.from("invoices").select("invoice_date,total,paid_amount").eq("company_id", companyId).neq("status", "void"),
      supabase.from("bills").select("bill_date,total,paid_amount").eq("company_id", companyId).neq("status", "void"),
      supabase.from("expenses").select("expense_date,amount").eq("company_id", companyId),
    ]);

    const sumNum = (arr: any[] | null, k: string) => (arr ?? []).reduce((s, r) => s + Number(r[k] || 0), 0);
    const sales = sumNum(invoices, "total");
    const purchases = sumNum(bills, "total");
    const expensesTotal = sumNum(expenses, "amount");
    const receivable = (invoices ?? []).reduce((s, r) => s + (Number(r.total) - Number(r.paid_amount)), 0);
    const payable = (bills ?? []).reduce((s, r) => s + (Number(r.total) - Number(r.paid_amount)), 0);

    setKpis({
      sales, purchases, expenses: expensesTotal,
      profit: sales - purchases - expensesTotal,
      receivable, payable, cash: 0,
    });

    // last 6 months chart
    const months: { key: string; month: string; Sales: number; Purchases: number; Expenses: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = startOfMonth(subMonths(new Date(), i));
      months.push({ key: format(d, "yyyy-MM"), month: format(d, "MMM"), Sales: 0, Purchases: 0, Expenses: 0 });
    }
    const bucket = (rows: any[] | null, dateKey: string, amtKey: string, target: keyof typeof months[0]) => {
      (rows ?? []).forEach((r) => {
        const k = r[dateKey]?.slice(0, 7);
        const m = months.find((x) => x.key === k);
        if (m) (m as any)[target] += Number(r[amtKey] || 0);
      });
    };
    bucket(invoices, "invoice_date", "total", "Sales");
    bucket(bills, "bill_date", "total", "Purchases");
    bucket(expenses, "expense_date", "amount", "Expenses");
    setChart(months.map(({ month, Sales, Purchases, Expenses }) => ({ month, Sales, Purchases, Expenses })));
    setLoading(false);
  };

  const cards = [
    { label: "Total Sales", value: kpis.sales, icon: ArrowUpRight, tint: "text-success bg-success-muted" },
    { label: "Total Purchases", value: kpis.purchases, icon: ArrowDownLeft, tint: "text-primary bg-primary-muted" },
    { label: "Expenses", value: kpis.expenses, icon: Receipt, tint: "text-warning bg-warning-muted" },
    { label: "Net Profit", value: kpis.profit, icon: TrendingUp, tint: kpis.profit >= 0 ? "text-success bg-success-muted" : "text-destructive bg-destructive/10" },
  ];

  const secondary = [
    { label: "Accounts Receivable", value: kpis.receivable, icon: Wallet, tone: "success" as const },
    { label: "Accounts Payable", value: kpis.payable, icon: Wallet, tone: "warning" as const },
    { label: "Cash & Bank", value: kpis.cash, icon: Package, tone: "neutral" as const },
  ];

  return (
    <>
      <PageHeader title="Dashboard" description="Overview of your business activity" />
      <div className="p-6 space-y-6">
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((c) => {
            const Icon = c.icon;
            return (
              <Card key={c.label} className="shadow-[var(--shadow-card)]">
                <CardContent className="p-5 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm text-muted-foreground truncate">{c.label}</p>
                    <div className={`h-9 w-9 shrink-0 rounded-lg flex items-center justify-center ${c.tint}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                  </div>
                  <p className="text-xl lg:text-2xl font-semibold text-foreground mt-3 num truncate" title={formatMoney(c.value)}>{formatMoney(c.value)}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
          {secondary.map((c) => (
            <Card key={c.label} className="shadow-[var(--shadow-card)]">
              <CardContent className="p-5 min-w-0">
                <p className="text-sm text-muted-foreground truncate">{c.label}</p>
                <p className="text-lg lg:text-xl font-semibold text-foreground mt-2 num truncate" title={formatMoney(c.value)}>{formatMoney(c.value)}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="shadow-[var(--shadow-card)]">
          <CardHeader><CardTitle className="text-base">Last 6 months</CardTitle></CardHeader>
          <CardContent>
            <div className="h-72 w-full">
              <ResponsiveContainer>
                <BarChart data={chart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Sales" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Purchases" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Expenses" fill="hsl(var(--warning))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {loading && <p className="text-sm text-muted-foreground text-center py-4">Loading…</p>}
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default Dashboard;
