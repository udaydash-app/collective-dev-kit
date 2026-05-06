import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ReturnToPOSButton } from "@/components/layout/ReturnToPOSButton";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import {
  ArrowUpRight, ArrowDownRight, ChevronDown, Sparkles,
  ShoppingCart, Receipt, Wallet, Package, Users, Boxes, BarChart3, Settings,
  Tags, Tag, Megaphone, CreditCard, FileText, Truck, Layers, Calculator,
  TrendingUp, BookOpen, ClipboardList, Banknote, PiggyBank, ScrollText,
  LineChart, Percent, ShoppingBag, FileBarChart, Store, MessagesSquare,
  Building2, HandCoins, BadgePercent, ShieldCheck, Activity,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip as RTooltip, CartesianGrid,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from "recharts";

const menuGroups: { label: string; items: { title: string; to: string; icon: any; color: string }[] }[] = [
  {
    label: "Sales & POS",
    items: [
      { title: "POS Terminal", to: "/admin/pos", icon: ShoppingCart, color: "from-emerald-500 to-teal-500" },
      { title: "Online Orders", to: "/admin/orders", icon: ShoppingBag, color: "from-blue-500 to-indigo-500" },
      { title: "Quotations", to: "/admin/quotations", icon: ScrollText, color: "from-amber-500 to-orange-500" },
      { title: "Open Cash Register", to: "/admin/open-cash-register", icon: Banknote, color: "from-lime-500 to-green-500" },
      { title: "Close Day Report", to: "/admin/close-day-report", icon: ClipboardList, color: "from-rose-500 to-pink-500" },
    ],
  },
  {
    label: "Catalog",
    items: [
      { title: "Products", to: "/admin/products", icon: Package, color: "from-violet-500 to-purple-500" },
      { title: "Categories", to: "/admin/categories", icon: Tags, color: "from-fuchsia-500 to-pink-500" },
      { title: "Pricing", to: "/admin/pricing", icon: Tag, color: "from-yellow-500 to-amber-500" },
      { title: "Stock & Price", to: "/admin/stock-and-price", icon: Layers, color: "from-cyan-500 to-blue-500" },
      { title: "Stock Adjustment", to: "/admin/stock-adjustment", icon: Boxes, color: "from-sky-500 to-cyan-500" },
      { title: "Barcode", to: "/admin/barcode", icon: ShieldCheck, color: "from-slate-500 to-slate-700" },
      { title: "Production", to: "/admin/production", icon: Activity, color: "from-emerald-500 to-green-600" },
    ],
  },
  {
    label: "Promotions",
    items: [
      { title: "Offers", to: "/admin/offers", icon: BadgePercent, color: "from-pink-500 to-rose-500" },
      { title: "Combo Offers", to: "/admin/combo-offers", icon: Percent, color: "from-orange-500 to-red-500" },
      { title: "BOGO Offers", to: "/admin/bogo-offers", icon: Sparkles, color: "from-amber-400 to-yellow-500" },
      { title: "Multi-Product BOGO", to: "/admin/multi-product-bogo", icon: Sparkles, color: "from-lime-400 to-emerald-500" },
      { title: "Announcements", to: "/admin/announcements", icon: Megaphone, color: "from-indigo-500 to-blue-500" },
    ],
  },
  {
    label: "Purchasing",
    items: [
      { title: "Purchases", to: "/admin/purchases", icon: Truck, color: "from-blue-500 to-cyan-500" },
      { title: "Purchase Orders", to: "/admin/purchase-orders", icon: FileText, color: "from-teal-500 to-emerald-500" },
      { title: "Supplier Payments", to: "/admin/supplier-payments", icon: HandCoins, color: "from-orange-500 to-amber-500" },
      { title: "Accounts Payable", to: "/admin/accounts-payable", icon: CreditCard, color: "from-red-500 to-rose-500" },
    ],
  },
  {
    label: "Customers & Communication",
    items: [
      { title: "Contacts", to: "/admin/contacts", icon: Users, color: "from-purple-500 to-fuchsia-500" },
      { title: "Import Contacts", to: "/admin/import-contacts", icon: Users, color: "from-violet-500 to-purple-600" },
      { title: "Live Chat", to: "/admin/live-chat", icon: MessagesSquare, color: "from-blue-500 to-indigo-600" },
      { title: "POS Users", to: "/admin/pos-users", icon: ShieldCheck, color: "from-slate-500 to-zinc-600" },
      { title: "Payment Receipts", to: "/admin/payment-receipts", icon: Receipt, color: "from-green-500 to-emerald-600" },
      { title: "Accounts Receivable", to: "/admin/accounts-receivable", icon: Wallet, color: "from-emerald-500 to-teal-600" },
    ],
  },
  {
    label: "Accounting",
    items: [
      { title: "Chart of Accounts", to: "/admin/chart-of-accounts", icon: BookOpen, color: "from-indigo-500 to-violet-500" },
      { title: "Journal Entries", to: "/admin/journal-entries", icon: ScrollText, color: "from-purple-500 to-pink-500" },
      { title: "General Ledger", to: "/admin/general-ledger", icon: BookOpen, color: "from-blue-500 to-sky-500" },
      { title: "Trial Balance", to: "/admin/trial-balance", icon: Calculator, color: "from-cyan-500 to-teal-500" },
      { title: "Profit & Loss", to: "/admin/profit-loss", icon: TrendingUp, color: "from-emerald-500 to-green-600" },
      { title: "Balance Sheet", to: "/admin/balance-sheet", icon: Building2, color: "from-slate-500 to-blue-600" },
      { title: "Cash Flow", to: "/admin/cash-flow", icon: PiggyBank, color: "from-amber-500 to-orange-600" },
      { title: "Trading Account", to: "/admin/trading-account", icon: LineChart, color: "from-fuchsia-500 to-pink-600" },
      { title: "Tax Collection", to: "/admin/tax-collection-report", icon: Calculator, color: "from-rose-500 to-red-600" },
      { title: "Expenses", to: "/admin/expenses", icon: Wallet, color: "from-red-500 to-orange-500" },
    ],
  },
  {
    label: "Reports & Analytics",
    items: [
      { title: "Analytics", to: "/admin/analytics", icon: BarChart3, color: "from-blue-500 to-purple-500" },
      { title: "Inventory Reports", to: "/admin/inventory-reports", icon: FileBarChart, color: "from-teal-500 to-cyan-500" },
      { title: "COGS Analysis", to: "/admin/cogs-analysis", icon: LineChart, color: "from-indigo-500 to-blue-600" },
      { title: "Profit Margin", to: "/admin/profit-margin-analysis", icon: TrendingUp, color: "from-emerald-500 to-teal-600" },
      { title: "P&L Analysis", to: "/admin/profit-loss-analysis", icon: BarChart3, color: "from-violet-500 to-purple-600" },
    ],
  },
  {
    label: "System",
    items: [
      { title: "Settings", to: "/admin/settings", icon: Settings, color: "from-slate-500 to-gray-700" },
      { title: "Import Products", to: "/admin/import-products", icon: Package, color: "from-zinc-500 to-slate-600" },
      { title: "Stores", to: "/stores", icon: Store, color: "from-emerald-500 to-green-600" },
    ],
  },
];

export default function DashboardModern() {
  const [recentOpen, setRecentOpen] = useState(true);

  // Last 14 days range for chart
  const since = new Date();
  since.setDate(since.getDate() - 13);
  since.setHours(0, 0, 0, 0);
  const today = new Date();
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);

  const { data: tx } = useQuery({
    queryKey: ["dashmodern-tx", since.toISOString()],
    queryFn: async () => {
      const { data } = await supabase
        .from("pos_transactions")
        .select("id, transaction_number, total, subtotal, discount, tax, payment_method, customer_name, created_at, items, created_by_pos_user, cashier_id")
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: false })
        .limit(500);
      return data || [];
    },
  });

  const { data: orders } = useQuery({
    queryKey: ["dashmodern-orders", since.toISOString()],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, order_number, total, status, payment_status, created_at, customer_name")
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: false })
        .limit(200);
      return data || [];
    },
  });

  const { data: counts } = useQuery({
    queryKey: ["dashmodern-counts"],
    queryFn: async () => {
      const [{ count: products }, { count: contacts }, { count: lowStock }] = await Promise.all([
        supabase.from("products").select("*", { count: "exact", head: true }),
        supabase.from("contacts").select("*", { count: "exact", head: true }),
        supabase.from("products").select("*", { count: "exact", head: true }).lte("stock_quantity", 5),
      ]);
      return { products: products || 0, contacts: contacts || 0, lowStock: lowStock || 0 };
    },
  });

  const { data: posUsers } = useQuery({
    queryKey: ["dashmodern-pos-users"],
    queryFn: async () => {
      const { data } = await supabase.from("pos_users").select("id, full_name, is_active");
      return data || [];
    },
  });

  // Per-user aggregation
  const userMap = new Map<string, { name: string }>();
  (posUsers || []).forEach((u: any) => userMap.set(u.id, { name: u.full_name || "Unknown" }));
  const perUser: Record<string, { name: string; sales: number; count: number }> = {};
  (tx || []).forEach((t: any) => {
    const uid = t.created_by_pos_user || t.cashier_id || "unknown";
    const name = userMap.get(uid)?.name || (uid === "unknown" ? "Unassigned" : "Unknown user");
    if (!perUser[uid]) perUser[uid] = { name, sales: 0, count: 0 };
    perUser[uid].sales += Number(t.total) || 0;
    perUser[uid].count += 1;
  });
  const userRows = Object.entries(perUser)
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.sales - a.sales);

  // Aggregate per day
  const days: { date: string; sales: number; transactions: number }[] = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    days.push({ date: `${d.getDate()}/${d.getMonth() + 1}`, sales: 0, transactions: 0 });
    (tx || []).forEach((t: any) => {
      if (t.created_at?.slice(0, 10) === key) {
        days[i].sales += Number(t.total) || 0;
        days[i].transactions += 1;
      }
    });
    (orders || []).forEach((o: any) => {
      if (o.created_at?.slice(0, 10) === key && o.payment_status === "paid") {
        days[i].sales += Number(o.total) || 0;
      }
    });
  }

  const todaySales = (tx || [])
    .filter((t: any) => new Date(t.created_at) >= startOfToday)
    .reduce((s: number, t: any) => s + (Number(t.total) || 0), 0);
  const todayTx = (tx || []).filter((t: any) => new Date(t.created_at) >= startOfToday).length;
  const periodSales = (tx || []).reduce((s: number, t: any) => s + (Number(t.total) || 0), 0);
  const avgTicket = (tx || []).length > 0 ? periodSales / (tx || []).length : 0;

  // Payment mix
  const paymentMix: Record<string, number> = {};
  (tx || []).forEach((t: any) => {
    const m = t.payment_method || "unknown";
    paymentMix[m] = (paymentMix[m] || 0) + (Number(t.total) || 0);
  });
  const pieData = Object.entries(paymentMix).map(([name, value]) => ({ name, value }));
  const pieColors = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--secondary))", "#f59e0b", "#ec4899", "#06b6d4"];

  const recent = [
    ...((tx || []).map((t: any) => ({
      id: t.id, ref: t.transaction_number, total: Number(t.total) || 0,
      date: t.created_at, type: "POS" as const, customer: t.customer_name || "Walk-in",
      items: Array.isArray(t.items) ? t.items.length : 0,
      user: userMap.get(t.created_by_pos_user || t.cashier_id || "")?.name || "—",
    }))),
    ...((orders || []).map((o: any) => ({
      id: o.id, ref: o.order_number, total: Number(o.total) || 0,
      date: o.created_at, type: "Online" as const, customer: o.customer_name || "Guest",
      items: 0, status: o.status,
      user: "Online",
    }))),
  ].sort((a, b) => +new Date(b.date) - +new Date(a.date)).slice(0, 25);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      <ReturnToPOSButton />

      {/* Hero */}
      <div className="relative overflow-hidden border-b">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-accent/5 to-transparent" />
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -left-24 w-96 h-96 bg-accent/20 rounded-full blur-3xl" />
        <div className="relative max-w-7xl mx-auto px-6 py-10">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-widest">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Admin Dashboard
          </div>
          <h1 className="mt-2 text-4xl md:text-5xl font-bold tracking-tight bg-gradient-to-br from-foreground to-foreground/60 bg-clip-text text-transparent">
            Welcome back, Admin
          </h1>
          <p className="mt-2 text-muted-foreground">Live operational overview · last 14 days</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* KPI cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Today's Sales" value={formatCurrency(todaySales)}
            icon={Banknote} trend="up" sub={`${todayTx} transactions today`}
            gradient="from-emerald-500/20 via-emerald-500/5 to-transparent"
          />
          <KpiCard
            label="14-Day Revenue" value={formatCurrency(periodSales)}
            icon={TrendingUp} trend="up" sub={`${(tx || []).length} POS sales`}
            gradient="from-blue-500/20 via-blue-500/5 to-transparent"
          />
          <KpiCard
            label="Avg. Ticket" value={formatCurrency(avgTicket)}
            icon={Receipt} sub="Per POS transaction"
            gradient="from-violet-500/20 via-violet-500/5 to-transparent"
          />
          <KpiCard
            label="Low Stock" value={String(counts?.lowStock ?? 0)}
            icon={Package} trend={(counts?.lowStock ?? 0) > 0 ? "down" : "up"}
            sub={`${counts?.products ?? 0} products · ${counts?.contacts ?? 0} contacts`}
            gradient="from-rose-500/20 via-rose-500/5 to-transparent"
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2 border-border/50 backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <BarChart3 className="h-5 w-5 text-primary" /> Sales Trend
              </CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={days}>
                  <defs>
                    <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <RTooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 }}
                    formatter={(v: any) => formatCurrency(Number(v))}
                  />
                  <Area type="monotone" dataKey="sales" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#g1)" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border-border/50 backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <CreditCard className="h-5 w-5 text-primary" /> Payment Mix
              </CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              {pieData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No data</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={4}>
                      {pieData.map((_, i) => <Cell key={i} fill={pieColors[i % pieColors.length]} />)}
                    </Pie>
                    <Legend />
                    <RTooltip formatter={(v: any) => formatCurrency(Number(v))} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent sales - expandable */}
        <Collapsible open={recentOpen} onOpenChange={setRecentOpen}>
          <Card className="border-border/50 backdrop-blur overflow-hidden">
            <CollapsibleTrigger asChild>
              <button className="w-full text-left">
                <CardHeader className="flex flex-row items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Receipt className="h-5 w-5 text-primary" /> Recent Sales
                      <Badge variant="secondary" className="ml-2">{recent.length}</Badge>
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">Latest POS transactions and online orders</p>
                  </div>
                  <ChevronDown className={`h-5 w-5 transition-transform ${recentOpen ? "rotate-180" : ""}`} />
                </CardHeader>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <ScrollArea className="h-[420px] pr-2">
                  <div className="space-y-2">
                    {recent.length === 0 && (
                      <div className="text-center py-12 text-muted-foreground text-sm">No recent sales</div>
                    )}
                    {recent.map((r) => (
                      <Link
                        key={`${r.type}-${r.id}`}
                        to={r.type === "POS" ? "/admin/pos" : `/order/${r.id}`}
                        className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:border-primary/40 hover:bg-muted/40 transition-all group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${r.type === "POS" ? "bg-primary/10 text-primary" : "bg-accent/10 text-accent-foreground"}`}>
                            {r.type === "POS" ? <ShoppingCart className="h-5 w-5" /> : <ShoppingBag className="h-5 w-5" />}
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium truncate">{r.ref}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {r.customer} · {formatDateTime(r.date)}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold tabular-nums">{formatCurrency(r.total)}</div>
                          <Badge variant={r.type === "POS" ? "default" : "secondary"} className="text-[10px] mt-0.5">
                            {r.type}
                          </Badge>
                        </div>
                      </Link>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* All menu items grouped */}
        <div className="space-y-6">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">All Modules</h2>
              <p className="text-sm text-muted-foreground">Quick access to every section of your business</p>
            </div>
          </div>
          {menuGroups.map((group) => (
            <div key={group.label}>
              <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">{group.label}</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link key={item.to} to={item.to} className="group">
                      <Card className="relative overflow-hidden h-full border-border/50 hover:border-primary/50 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300">
                        <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 bg-gradient-to-br ${item.color} transition-opacity duration-300`} />
                        <CardContent className="relative p-4">
                          <div className={`h-10 w-10 rounded-lg flex items-center justify-center bg-gradient-to-br ${item.color} text-white shadow-md mb-3`}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="font-medium text-sm group-hover:text-white transition-colors">{item.title}</div>
                          <ArrowUpRight className="absolute top-3 right-3 h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:text-white transition-all" />
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, icon: Icon, trend, sub, gradient }: {
  label: string; value: string; icon: any; trend?: "up" | "down"; sub?: string; gradient: string;
}) {
  return (
    <Card className="relative overflow-hidden border-border/50">
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`} />
      <CardContent className="relative p-5">
        <div className="flex items-start justify-between">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</div>
          <div className="h-9 w-9 rounded-lg bg-background/60 backdrop-blur flex items-center justify-center border border-border/50">
            <Icon className="h-4 w-4 text-primary" />
          </div>
        </div>
        <div className="mt-3 text-2xl font-bold tabular-nums">{value}</div>
        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          {trend === "up" && <ArrowUpRight className="h-3 w-3 text-emerald-500" />}
          {trend === "down" && <ArrowDownRight className="h-3 w-3 text-rose-500" />}
          <span className="truncate">{sub}</span>
        </div>
      </CardContent>
    </Card>
  );
}