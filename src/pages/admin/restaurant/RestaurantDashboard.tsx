import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { RestaurantNavButtons } from '@/components/layout/RestaurantNavButtons';
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

function startOfToday() { const d = new Date(); d.setHours(0,0,0,0); return d.toISOString(); }

export default function RestaurantDashboard() {
  const navigate = useNavigate();
  const [tables, setTables] = useState<RTable[]>([]);
  const [openByTable, setOpenByTable] = useState<Record<string, OpenOrder>>({});
  const [recent, setRecent] = useState<RecentOrder[]>([]);
  const [salesToday, setSalesToday] = useState(0);
  const [ordersToday, setOrdersToday] = useState(0);
  const [topItems, setTopItems] = useState<TopItem[]>([]);
  const [currency, setCurrency] = useState('FCFA');

  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, []);

  async function load() {
    const today = startOfToday();
    const [tRes, openRes, recentRes, paidTodayRes, settingsRes] = await Promise.all([
      sb.from('restaurant_tables').select('*').order('name'),
      sb.from('restaurant_orders').select('table_id,total,guest_count,order_no')
        .not('table_id', 'is', null).neq('status', 'paid').neq('status', 'void'),
      sb.from('restaurant_orders').select('id,order_no,type,table_id,status,total,created_at,guest_count')
        .neq('status', 'void').order('created_at', { ascending: false }).limit(12),
      sb.from('restaurant_orders').select('id,total').eq('status', 'paid').gte('created_at', today),
      sb.from('restaurant_settings').select('currency_symbol').limit(1).maybeSingle(),
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

        {/* Top Selling */}
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
      </div>

      {/* Recent orders */}
      <Card className="p-4 bg-white/80 dark:bg-slate-900/70 backdrop-blur border-white/40">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold flex items-center gap-2"><Clock className="h-4 w-4 text-orange-500" /> Recent Orders</h2>
          <Link to="/admin/restaurant/pos" className="text-xs text-orange-600 flex items-center gap-1 hover:underline">View POS <ArrowRight className="h-3 w-3" /></Link>
        </div>
        <ScrollArea className="max-h-[360px]">
          <div className="space-y-2 pr-2">
            {recent.map(o => {
              const tbl = tables.find(t => t.id === o.table_id);
              const TypeIcon = o.type === 'dine_in' ? Users : o.type === 'takeaway' ? ShoppingBag : Bike;
              return (
                <button key={o.id}
                  onClick={() => o.table_id ? navigate(`/admin/restaurant/pos?table=${o.table_id}`) : navigate('/admin/restaurant/pos')}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-orange-50 dark:hover:bg-orange-950/30 hover:border-orange-200 border border-transparent transition text-left">
                  <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-white">
                    <TypeIcon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm">#{o.order_no}</span>
                      {tbl && <Badge variant="outline" className="text-[10px] h-4 px-1.5">Table {tbl.name}</Badge>}
                      <Badge className={`text-[10px] h-4 px-1.5 border-0 ${
                        o.status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                        o.status === 'open' ? 'bg-sky-100 text-sky-700' :
                        o.status === 'sent' ? 'bg-amber-100 text-amber-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>{o.status}</Badge>
                    </div>
                    <div className="text-[11px] text-muted-foreground">{new Date(o.created_at).toLocaleTimeString()} · {o.type.replace('_',' ')}</div>
                  </div>
                  <div className="font-black text-orange-600 dark:text-orange-400">{fmt(o.total)}</div>
                </button>
              );
            })}
            {!recent.length && (
              <div className="text-sm text-muted-foreground text-center py-8">No recent orders.</div>
            )}
          </div>
        </ScrollArea>
      </Card>
    </div>
  );
}