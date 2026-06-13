import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { RestaurantNavButtons } from '@/components/layout/RestaurantNavButtons';
import { RestaurantOrderViewDialog } from '@/components/restaurant/RestaurantOrderViewDialog';
import {
  UtensilsCrossed, Users, Receipt, TrendingUp, Flame, Clock,
  ShoppingBag, Bike, Settings as SettingsIcon, ChefHat, Menu as MenuIcon,
  ArrowRight, CircleDollarSign,
} from 'lucide-react';

const sb: any = supabase;

type RTable = { id: string; name: string; seats: number; status: string; shape: string };
type OpenOrder = { table_id: string | null; total: number; guest_count: number; order_no: string };
type RecentOrder = {
  id: string; order_no: string; type: string; table_id: string | null;
  status: string; total: number; created_at: string; guest_count: number;
};
type TopItem = { name: string; qty: number; revenue: number };
type RunningKot = {
  order_id: string;
  order_no: string;
  table_name: string | null;
  type: string;
  items: { name: string; qty: number; batch: number; created_at: string }[];
};

function startOfToday() { const d = new Date(); d.setHours(0,0,0,0); return d.toISOString(); }

export default function RestaurantDashboard() {
  const navigate = useNavigate();
  const [tables, setTables] = useState<RTable[]>([]);
  const [openByTable, setOpenByTable] = useState<Record<string, OpenOrder>>({});
  const [recent, setRecent] = useState<RecentOrder[]>([]);
  const [salesToday, setSalesToday] = useState(0);
  const [ordersToday, setOrdersToday] = useState(0);
  const [topItems, setTopItems] = useState<TopItem[]>([]);
  const [runningKots, setRunningKots] = useState<RunningKot[]>([]);
  const [currency, setCurrency] = useState('FCFA');
  const [viewOrderId, setViewOrderId] = useState<string | null>(null);

  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, []);

  async function load() {
    const today = startOfToday();
    const [tRes, openRes, recentRes, paidTodayRes, settingsRes, kotOrdersRes] = await Promise.all([
      sb.from('restaurant_tables').select('*').order('name'),
      sb.from('restaurant_orders').select('table_id,total,guest_count,order_no')
        .not('table_id', 'is', null).neq('status', 'paid').neq('status', 'void'),
      sb.from('restaurant_orders').select('id,order_no,type,table_id,status,total,created_at,guest_count')
        .eq('status', 'paid').order('created_at', { ascending: false }).limit(12),
      sb.from('restaurant_orders').select('id,total').eq('status', 'paid').gte('created_at', today),
      sb.from('restaurant_settings').select('currency_symbol').limit(1).maybeSingle(),
      sb.from('restaurant_orders').select('id,order_no,type,table_id').eq('status', 'sent').order('created_at', { ascending: false }),
    ]);
    setTables((tRes.data as any) || []);
    const map: Record<string, OpenOrder> = {};
    ((openRes.data as any[]) || []).forEach(o => { if (o.table_id) map[o.table_id] = o; });
    setOpenByTable(map);
    setRecent((recentRes.data as any) || []);
    const paid = (paidTodayRes.data as any[]) || [];
    setSalesToday(paid.reduce((s, o) => s + (Number(o.total) || 0), 0));
    setOrdersToday(paid.length);
    if (settingsRes.data?.currency_symbol) setCurrency(settingsRes.data.currency_symbol);

    // Top selling items today
    if (paid.length) {
      const ids = paid.map(p => p.id);
      const { data: oi } = await sb.from('restaurant_order_items')
        .select('name,qty,unit_price,order_id').in('order_id', ids);
      const agg = new Map<string, TopItem>();
      ((oi as any[]) || []).forEach(r => {
        const k = r.name;
        const cur = agg.get(k) || { name: k, qty: 0, revenue: 0 };
        cur.qty += Number(r.qty) || 0;
        cur.revenue += (Number(r.qty) || 0) * (Number(r.unit_price) || 0);
        agg.set(k, cur);
      });
      setTopItems([...agg.values()].sort((a, b) => b.qty - a.qty).slice(0, 6));
    } else {
      setTopItems([]);
    }

    // Running KOTs: orders with status='sent' (KOT fired, bill not yet printed)
    const kotOrders = (kotOrdersRes.data as any[]) || [];
    if (kotOrders.length) {
      const ids = kotOrders.map(o => o.id);
      const { data: kItems } = await sb.from('restaurant_order_items')
        .select('order_id,name,qty,kot_status,kot_batch,created_at')
        .in('order_id', ids)
        .eq('kot_status', 'sent')
        .order('created_at', { ascending: true });
      const tblMap = new Map(((tRes.data as any[]) || []).map((t: any) => [t.id, t.name]));
      const grouped: RunningKot[] = kotOrders.map(o => ({
        order_id: o.id,
        order_no: o.order_no,
        table_name: o.table_id ? (tblMap.get(o.table_id) || null) : null,
        type: o.type,
        items: ((kItems as any[]) || [])
          .filter(it => it.order_id === o.id)
          .map(it => ({ name: it.name, qty: Number(it.qty), batch: it.kot_batch || 0, created_at: it.created_at })),
      })).filter(g => g.items.length > 0);
      setRunningKots(grouped);
    } else {
      setRunningKots([]);
    }
  }

  const occupiedCount = useMemo(() => Object.keys(openByTable).length, [openByTable]);
  const fmt = (n: number) => `${Number(n).toFixed(0)} ${currency}`;

  function goToTable(t: RTable) {
    navigate(`/admin/restaurant/pos?table=${t.id}`);
  }

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-50 via-orange-50/30 to-amber-50/40 dark:from-slate-950 dark:via-slate-900 dark:to-orange-950/20 p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-lg shadow-orange-500/30">
            <UtensilsCrossed className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black">Restaurant Dashboard</h1>
            <p className="text-xs text-muted-foreground">Live overview · {new Date().toLocaleDateString()}</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <RestaurantNavButtons />
          <Link to="/admin/restaurant/menu"><Button variant="outline" size="sm" className="rounded-full"><MenuIcon className="h-4 w-4 mr-1.5" /> Menu</Button></Link>
          <Link to="/admin/restaurant/tables"><Button variant="outline" size="sm" className="rounded-full"><Users className="h-4 w-4 mr-1.5" /> Tables</Button></Link>
          <Link to="/admin/restaurant/settings"><Button variant="outline" size="sm" className="rounded-full"><SettingsIcon className="h-4 w-4 mr-1.5" /> Settings</Button></Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 border-0 bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-lg shadow-emerald-500/30">
          <div className="flex items-center justify-between"><span className="text-xs uppercase opacity-90">Sales Today</span><CircleDollarSign className="h-5 w-5 opacity-80" /></div>
          <div className="text-3xl font-black mt-2">{fmt(salesToday)}</div>
        </Card>
        <Card className="p-4 border-0 bg-gradient-to-br from-orange-500 to-red-600 text-white shadow-lg shadow-orange-500/30">
          <div className="flex items-center justify-between"><span className="text-xs uppercase opacity-90">Orders Today</span><Receipt className="h-5 w-5 opacity-80" /></div>
          <div className="text-3xl font-black mt-2">{ordersToday}</div>
        </Card>
        <Card className="p-4 border-0 bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/30">
          <div className="flex items-center justify-between"><span className="text-xs uppercase opacity-90">Occupied</span><Users className="h-5 w-5 opacity-80" /></div>
          <div className="text-3xl font-black mt-2">{occupiedCount}<span className="text-base font-bold opacity-80"> / {tables.length}</span></div>
        </Card>
        <Card className="p-4 border-0 bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/30">
          <div className="flex items-center justify-between"><span className="text-xs uppercase opacity-90">Avg Ticket</span><TrendingUp className="h-5 w-5 opacity-80" /></div>
          <div className="text-3xl font-black mt-2">{fmt(ordersToday ? salesToday / ordersToday : 0)}</div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Tables */}
        <Card className="lg:col-span-2 p-4 bg-white/80 dark:bg-slate-900/70 backdrop-blur border-white/40">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold flex items-center gap-2"><Users className="h-4 w-4 text-orange-500" /> Tables</h2>
            <div className="flex gap-3 text-[11px]">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Free</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-orange-500" /> Occupied</span>
            </div>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-5 gap-3">
            {tables.map(t => {
              const open = openByTable[t.id];
              const occ = !!open || t.status === 'occupied';
              return (
                <button key={t.id} onClick={() => goToTable(t)}
                  className={`group relative aspect-square rounded-2xl border-2 font-bold transition-all duration-200 hover:scale-[1.04] active:scale-95 shadow-md ${
                    occ
                      ? 'bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-950/40 dark:to-amber-950/40 border-orange-300 dark:border-orange-700 text-orange-900 dark:text-orange-200'
                      : 'bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 hover:border-emerald-400'
                  } ${t.shape === 'round' ? 'rounded-full' : ''}`}>
                  <div className="text-xl leading-none mt-2">{t.name}</div>
                  {open ? (
                    <>
                      <div className="text-[10px] mt-1 opacity-80 flex items-center justify-center gap-1"><Users className="h-2.5 w-2.5" />{open.guest_count || 0}/{t.seats}</div>
                      <div className="text-[11px] font-black mt-0.5">{Number(open.total).toFixed(0)} {currency}</div>
                      <div className="text-[9px] opacity-70 mt-0.5">#{open.order_no}</div>
                    </>
                  ) : (
                    <div className="text-[10px] opacity-70 mt-1">{t.seats} seats</div>
                  )}
                  {occ && <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-orange-500 animate-pulse" />}
                </button>
              );
            })}
            {!tables.length && (
              <div className="col-span-full text-sm text-muted-foreground text-center py-8">
                No tables yet. <Link to="/admin/restaurant/tables" className="text-orange-600 underline">Add tables</Link>.
              </div>
            )}
          </div>
        </Card>

        {/* Right column: Top Selling + Running KOT */}
        <div className="space-y-4">
          <Card className="p-4 bg-white/80 dark:bg-slate-900/70 backdrop-blur border-white/40">
            <h2 className="font-bold flex items-center gap-2 mb-3"><Flame className="h-4 w-4 text-orange-500" /> Top Selling Today</h2>
            <div className="space-y-2">
              {topItems.map((it, i) => (
                <div key={it.name} className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center font-black text-white text-sm ${
                    i === 0 ? 'bg-gradient-to-br from-amber-400 to-orange-500' :
                    i === 1 ? 'bg-gradient-to-br from-slate-300 to-slate-500' :
                    i === 2 ? 'bg-gradient-to-br from-orange-400 to-amber-600' :
                    'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                  }`}>{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">{it.name}</div>
                    <div className="text-[11px] text-muted-foreground">{it.qty} sold</div>
                  </div>
                  <div className="font-bold text-sm text-orange-600 dark:text-orange-400">{fmt(it.revenue)}</div>
                </div>
              ))}
              {!topItems.length && (
                <div className="text-xs text-muted-foreground text-center py-8">No sales yet today.</div>
              )}
            </div>
          </Card>

          <Card className="p-4 bg-white/80 dark:bg-slate-900/70 backdrop-blur border-white/40">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold flex items-center gap-2"><ChefHat className="h-4 w-4 text-amber-500" /> Running KOT</h2>
              {runningKots.length > 0 && (
                <Badge className="bg-amber-100 text-amber-700 border-0 text-[10px]">{runningKots.length}</Badge>
              )}
            </div>
            <ScrollArea className="max-h-[320px]">
              <div className="space-y-2 pr-2">
                {runningKots.map(k => (
                  <button key={k.order_id} onClick={() => setViewOrderId(k.order_id)}
                    className="w-full text-left rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/20 hover:bg-amber-100/70 dark:hover:bg-amber-950/40 transition p-2.5">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="font-bold text-sm">#{k.order_no}</span>
                      {k.table_name && <Badge variant="outline" className="text-[10px] h-4 px-1.5">T {k.table_name}</Badge>}
                      <Badge className="text-[10px] h-4 px-1.5 border-0 bg-amber-200 text-amber-800 ml-auto">{k.items.reduce((s, i) => s + i.qty, 0)} qty</Badge>
                    </div>
                    <div className="space-y-0.5">
                      {k.items.map((it, idx) => (
                        <div key={idx} className="flex items-baseline gap-2 text-[12px]">
                          <span className="font-bold text-amber-700 dark:text-amber-400 w-6 shrink-0">{it.qty}×</span>
                          <span className="truncate flex-1">{it.name}</span>
                          {it.batch > 0 && <span className="text-[9px] text-muted-foreground">#{it.batch}</span>}
                        </div>
                      ))}
                    </div>
                  </button>
                ))}
                {!runningKots.length && (
                  <div className="text-xs text-muted-foreground text-center py-6">No running KOTs.</div>
                )}
              </div>
            </ScrollArea>
          </Card>
        </div>
      </div>

      {/* Recent orders (compact) */}
      <Card className="border-border/50 bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h2 className="text-sm font-bold">Recent Orders</h2>
            <p className="text-xs text-muted-foreground">{recent.length} paid orders</p>
          </div>
          <Link to="/admin/restaurant/pos" className="text-xs text-primary flex items-center gap-1 hover:underline">POS <ArrowRight className="h-3 w-3" /></Link>
        </div>
        <ScrollArea className="max-h-[260px]">
          <div className="min-w-[720px] text-xs">
            <div className="grid grid-cols-[1.1fr_0.9fr_1fr_1fr_1fr] border-b border-border bg-muted/40 px-4 py-2 font-semibold text-muted-foreground">
              <div>Order #</div>
              <div>Type</div>
              <div>Table</div>
              <div>Status / Time</div>
              <div className="text-right">Total</div>
            </div>
            {recent.slice(0, 9).map(o => {
              const tbl = tables.find(t => t.id === o.table_id);
              const TypeIcon = o.type === 'dine_in' ? Users : o.type === 'takeaway' ? ShoppingBag : Bike;
              return (
                <button key={o.id}
                  onClick={() => setViewOrderId(o.id)}
                  className="grid w-full grid-cols-[1.1fr_0.9fr_1fr_1fr_1fr] items-center border-b border-border/70 px-4 py-2 text-left hover:bg-muted/50">
                  <div className="font-semibold">#{o.order_no}</div>
                  <div className="flex items-center gap-1.5 capitalize text-muted-foreground">
                    <TypeIcon className="h-3.5 w-3.5" />
                    {o.type.replace('_', ' ')}
                  </div>
                  <div>{tbl ? <Badge variant="outline" className="h-5 text-[10px]">T{tbl.name}</Badge> : <span className="text-muted-foreground">—</span>}</div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="h-5 text-[10px] capitalize">{o.status}</Badge>
                    <span className="text-muted-foreground">{new Date(o.created_at).toLocaleTimeString()}</span>
                  </div>
                  <div className="text-right font-bold">{fmt(o.total)}</div>
                </button>
              );
            })}
            {!recent.length && (
              <div className="col-span-full text-xs text-muted-foreground text-center py-4">No recent orders.</div>
            )}
          </div>
        </ScrollArea>
      </Card>
      <RestaurantOrderViewDialog
        orderId={viewOrderId}
        open={!!viewOrderId}
        onOpenChange={(o) => { if (!o) setViewOrderId(null); }}
        currency={currency}
        onSaved={load}
      />
    </div>
  );
}