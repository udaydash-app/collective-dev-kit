import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RestaurantNavButtons } from '@/components/layout/RestaurantNavButtons';
import { Trash2, Plus, Minus, Printer, ChefHat, CreditCard, Users, Bike, ShoppingBag, UtensilsCrossed, Search, Sparkles, Receipt, Settings as SettingsIcon } from 'lucide-react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useDesktopWindowId } from '@/components/desktop/DesktopWindowContext';
import { windowActions } from '@/store/windowStore';

async function printHtml(html: string, widthMm = 80) {
  const w = window.open('', '_blank', 'width=420,height=640');
  if (!w) return;
  w.document.write(`<html><head><title>Print</title><style>
    @page { size: ${widthMm}mm auto; margin: 0; }
    html, body { margin: 0; padding: 0; }
    body { width: ${widthMm}mm; font-family: 'Courier New', monospace; color: #000; }
    .r { width: ${widthMm - 4}mm; padding: 2mm; font-size: 12px; line-height: 1.35; }
    .r h1 { font-size: 16px; margin: 0 0 2px; text-align: center; }
    .r h2 { font-size: 14px; margin: 0; text-align: center; letter-spacing: 1px; }
    .r .ctr { text-align: center; }
    .r .row { display: flex; justify-content: space-between; gap: 6px; }
    .r .b { font-weight: 700; }
    .r hr { border: 0; border-top: 1px dashed #000; margin: 4px 0; }
    .r .big { font-size: 15px; font-weight: 800; }
    .r img { max-width: 60%; max-height: 80px; display: block; margin: 0 auto 4px; }
  </style></head><body>${html}<script>window.onload=()=>{window.print();setTimeout(()=>window.close(),300)}</script></body></html>`);
  w.document.close();
}

// Supabase types aren't regenerated yet for restaurant_* tables; use a loose alias.
const sb: any = supabase;

type Cat = { id: string; name: string; color: string | null };
type Item = { id: string; category_id: string | null; name: string; price: number; image_url: string | null; is_available: boolean; kot_printer: string };
type RTable = { id: string; name: string; seats: number; status: string; x: number; y: number; shape: string };
type OrderItem = { id?: string; menu_item_id: string; name: string; qty: number; unit_price: number; note?: string; kot_status?: string; kot_batch?: number };
type Order = { id: string; order_no: string; type: string; table_id: string | null; status: string; subtotal: number; tax: number; service_charge: number; discount: number; total: number; guest_count?: number; customer_name?: string; customer_phone?: string; delivery_address?: string };
type Settings = { company_name: string; logo_url?: string|null; address?: string|null; phone?: string|null; email?: string|null; website?: string|null; tax_number?: string|null; receipt_footer?: string|null; currency_symbol: string; paper_width_mm: number };

export default function RestaurantPOS() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const desktopWindowId = useDesktopWindowId();
  const goToRestaurant = () => {
    if (desktopWindowId) {
      windowActions.close(desktopWindowId);
      windowActions.openApp('restaurant');
    } else {
      navigate('/admin/restaurant');
    }
  };
  const [cats, setCats] = useState<Cat[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [tables, setTables] = useState<RTable[]>([]);
  const [tableOrders, setTableOrders] = useState<Record<string, { total: number; guest_count: number; order_no: string }>>({});
  const [settings, setSettings] = useState<Settings>({ company_name: 'Restaurant', currency_symbol: 'FCFA', paper_width_mm: 80 });
  const [guestDialog, setGuestDialog] = useState<{ table: RTable | null; open: boolean }>({ table: null, open: false });
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [orderType, setOrderType] = useState<'dine_in' | 'takeaway' | 'delivery'>('dine_in');
  const [order, setOrder] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [search, setSearch] = useState('');
  const [payOpen, setPayOpen] = useState(false);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [tablePickerOpen, setTablePickerOpen] = useState(false);
  const [pendingItem, setPendingItem] = useState<Item | null>(null);

  const session = (() => { try { return JSON.parse(localStorage.getItem('offline_pos_session') || 'null'); } catch { return null; } })();

  useEffect(() => { reload(); }, []);
  // Auto-open a table when arrived via ?table=<id>
  useEffect(() => {
    const tid = searchParams.get('table');
    if (!tid || !tables.length) return;
    const t = tables.find(x => x.id === tid);
    if (!t) return;
    setOrderType('dine_in');
    if (tableOrders[tid]) {
      openOrder(tid, 'dine_in');
    } else {
      setGuestDialog({ table: t, open: true });
    }
    // consume the param so it doesn't retrigger
    searchParams.delete('table');
    setSearchParams(searchParams, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F2') { e.preventDefault(); sendKOT(); }
      else if (e.key === 'F3') { e.preventDefault(); printBill(); }
      else if (e.key === 'F4') { e.preventDefault(); setPayOpen(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  async function reload() {
    const [c, i, t, s, openOrders] = await Promise.all([
      sb.from('restaurant_menu_categories').select('*').eq('is_active', true).order('sort_order'),
      sb.from('restaurant_menu_items').select('*').eq('is_available', true).order('sort_order'),
      sb.from('restaurant_tables').select('*').order('name'),
      sb.from('restaurant_settings').select('*').limit(1).maybeSingle(),
      sb.from('restaurant_orders').select('table_id,total,guest_count,order_no').not('table_id', 'is', null).neq('status', 'paid').neq('status', 'void'),
    ]);
    setCats((c.data as any) || []);
    setItems((i.data as any) || []);
    setTables((t.data as any) || []);
    if (s.data) setSettings({ ...settings, ...(s.data as any) });
    const map: Record<string, any> = {};
    ((openOrders.data as any[]) || []).forEach(o => { if (o.table_id) map[o.table_id] = { total: Number(o.total) || 0, guest_count: Number(o.guest_count) || 0, order_no: o.order_no }; });
    setTableOrders(map);
    if (c.data && c.data.length && !activeCat) setActiveCat(c.data[0].id);
  }

  const visible = useMemo(() => items.filter(it =>
    (!activeCat || it.category_id === activeCat) &&
    (!search || it.name.toLowerCase().includes(search.toLowerCase()))
  ), [items, activeCat, search]);

  async function openOrder(tableId: string | null, type: 'dine_in' | 'takeaway' | 'delivery', extra: Partial<Order> = {}) {
    if (tableId) {
      const { data: existing } = await sb.from('restaurant_orders').select('*').eq('table_id', tableId).neq('status', 'paid').neq('status', 'void').maybeSingle();
      if (existing) {
        setOrder(existing as any);
        setOrderType((existing as any).type as any);
        const { data: oi } = await sb.from('restaurant_order_items').select('*').eq('order_id', (existing as any).id).order('created_at');
        setOrderItems((oi as any) || []);
        return;
      }
    }
    const { data, error } = await sb.from('restaurant_orders').insert({
      type, table_id: tableId, status: 'open', opened_by: session?.id || null, ...extra,
    }).select().single();
    if (error) { toast.error(error.message); return; }
    setOrder(data as any);
    setOrderType(type);
    setOrderItems([]);
  }

  function onTableClick(t: RTable) {
    // If table already has an open order, open it directly
    if (tableOrders[t.id]) { openOrder(t.id, 'dine_in'); return; }
    // Otherwise prompt for guest count first
    setGuestDialog({ table: t, open: true });
  }

  async function updateGuestCount(n: number) {
    if (!order) return;
    await sb.from('restaurant_orders').update({ guest_count: n }).eq('id', order.id);
    setOrder({ ...order, guest_count: n });
    if (order.table_id) {
      setTableOrders(prev => ({ ...prev, [order.table_id!]: { ...(prev[order.table_id!] || { total: order.total, order_no: order.order_no }), guest_count: n } }));
    }
  }

  async function addItem(it: Item) {
    if (!order) {
      if (orderType === 'dine_in') {
        // Cart is empty and no table chosen → prompt for table selection
        setPendingItem(it);
        setTablePickerOpen(true);
        return;
      }
      await openOrder(null, orderType);
      // try again next tick
      setTimeout(() => addItem(it), 100);
      return;
    }
    // merge with same item & kot_status new
    const existing = orderItems.find(o => o.menu_item_id === it.id && o.kot_status === 'new');
    if (existing && existing.id) {
      const newQty = Number(existing.qty) + 1;
      await sb.from('restaurant_order_items').update({ qty: newQty }).eq('id', existing.id);
      setOrderItems(prev => prev.map(p => p.id === existing.id ? { ...p, qty: newQty } : p));
    } else {
      const { data, error } = await sb.from('restaurant_order_items').insert({
        order_id: order.id, menu_item_id: it.id, name: it.name, qty: 1, unit_price: it.price, kot_status: 'new',
      }).select().single();
      if (error) { toast.error(error.message); return; }
      setOrderItems(prev => [...prev, data as any]);
    }
    refreshOrderTotals();
  }

  async function changeQty(oi: OrderItem, delta: number) {
    const newQty = Number(oi.qty) + delta;
    if (newQty <= 0) { await removeItem(oi); return; }
    await sb.from('restaurant_order_items').update({ qty: newQty }).eq('id', oi.id!);
    setOrderItems(prev => prev.map(p => p.id === oi.id ? { ...p, qty: newQty } : p));
    refreshOrderTotals();
  }

  async function removeItem(oi: OrderItem) {
    if (oi.kot_status && oi.kot_status !== 'new') { toast.error('Item already sent to kitchen'); return; }
    await sb.from('restaurant_order_items').delete().eq('id', oi.id!);
    setOrderItems(prev => prev.filter(p => p.id !== oi.id));
    refreshOrderTotals();
  }

  async function refreshOrderTotals() {
    if (!order) return;
    const { data } = await sb.from('restaurant_orders').select('*').eq('id', order.id).single();
    if (data) {
      setOrder(data as any);
      if ((data as any).table_id) {
        setTableOrders(prev => ({ ...prev, [(data as any).table_id]: { total: Number((data as any).total) || 0, guest_count: Number((data as any).guest_count) || 0, order_no: (data as any).order_no } }));
      }
    }
  }

  async function sendKOT() {
    if (!order) return;
    const newItems = orderItems.filter(o => o.kot_status === 'new');
    if (!newItems.length) { toast.info('No new items to send'); return; }
    const nextBatch = (Math.max(0, ...orderItems.map(o => o.kot_batch || 0))) + 1;
    await sb.from('restaurant_order_items')
      .update({ kot_status: 'sent', kot_batch: nextBatch })
      .in('id', newItems.map(n => n.id!));
    await sb.from('restaurant_orders').update({ status: 'sent' }).eq('id', order.id);
    // Print KOT (kitchen ticket, no prices)
    const tableName = order.table_id ? (tables.find(t => t.id === order.table_id)?.name || '') : '';
    const html = `
      <div class="r">
        <h2>*** KOT ***</h2>
        <div class="row"><span>Order:</span><span class="b">${order.order_no}</span></div>
        <div class="row"><span>Type:</span><span>${order.type.toUpperCase()}</span></div>
        ${tableName ? `<div class="row"><span>Table:</span><span class="b">${tableName}</span></div>` : ''}
        ${order.guest_count ? `<div class="row"><span>Guests:</span><span>${order.guest_count}</span></div>` : ''}
        <div class="row"><span>Batch:</span><span>#${nextBatch}</span></div>
        <div class="row"><span>Time:</span><span>${new Date().toLocaleTimeString()}</span></div>
        <hr/>
        ${newItems.map(n => `<div class="big">${n.qty} × ${n.name}</div>${n.note ? `<div style="font-style:italic">→ ${n.note}</div>` : ''}`).join('')}
      </div>`;
    try { await printHtml(html, settings.paper_width_mm); } catch { window.print(); }
    setOrderItems(prev => prev.map(p => p.kot_status === 'new' ? { ...p, kot_status: 'sent', kot_batch: nextBatch } : p));
    toast.success('Sent to kitchen');
  }

  async function printBill() {
    if (!order) return;
    const cur = settings.currency_symbol || '';
    const fmt = (n: number) => `${Number(n).toFixed(0)} ${cur}`.trim();
    const tableName = order.table_id ? (tables.find(t => t.id === order.table_id)?.name || '') : '';
    const html = `
      <div class="r">
        ${settings.logo_url ? `<img src="${settings.logo_url}" alt="logo"/>` : ''}
        <h1>${settings.company_name || 'RESTAURANT'}</h1>
        ${settings.address ? `<div class="ctr">${settings.address}</div>` : ''}
        ${settings.phone ? `<div class="ctr">Tel: ${settings.phone}</div>` : ''}
        ${settings.tax_number ? `<div class="ctr">${settings.tax_number}</div>` : ''}
        <hr/>
        <div class="row"><span>Bill:</span><span class="b">${order.order_no}</span></div>
        <div class="row"><span>Date:</span><span>${new Date().toLocaleString()}</span></div>
        ${tableName ? `<div class="row"><span>Table:</span><span class="b">${tableName}</span></div>` : ''}
        ${order.guest_count ? `<div class="row"><span>Guests:</span><span>${order.guest_count}</span></div>` : ''}
        ${order.customer_name ? `<div class="row"><span>Customer:</span><span>${order.customer_name}</span></div>` : ''}
        <hr/>
        ${orderItems.filter(o => o.kot_status !== 'void').map(o => `
          <div class="row"><span>${o.qty} × ${o.name}</span><span>${fmt(o.qty * o.unit_price)}</span></div>
        `).join('')}
        <hr/>
        <div class="row"><span>Subtotal</span><span>${fmt(order.subtotal)}</span></div>
        ${order.discount > 0 ? `<div class="row"><span>Discount</span><span>-${fmt(order.discount)}</span></div>` : ''}
        ${order.service_charge > 0 ? `<div class="row"><span>Service</span><span>${fmt(order.service_charge)}</span></div>` : ''}
        ${order.tax > 0 ? `<div class="row"><span>Tax</span><span>${fmt(order.tax)}</span></div>` : ''}
        <hr/>
        <div class="row big"><span>TOTAL</span><span>${fmt(order.total)}</span></div>
        <hr/>
        <div class="ctr" style="margin-top:6px">${settings.receipt_footer || 'Thank you!'}</div>
        ${settings.website ? `<div class="ctr">${settings.website}</div>` : ''}
      </div>`;
    try { await printHtml(html, settings.paper_width_mm); } catch { window.print(); }
  }

  function clearOrder() {
    setOrder(null);
    setOrderItems([]);
    reload();
  }

  async function clearTable(t: RTable, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      // Find open order on this table
      const { data: openOrd, error: ordErr } = await sb
        .from('restaurant_orders')
        .select('id')
        .eq('table_id', t.id)
        .neq('status', 'paid')
        .neq('status', 'void')
        .maybeSingle();
      if (ordErr) { toast.error('Error checking order: ' + ordErr.message); return; }

      if (openOrd) {
        const { data: sentItems, error: sentErr } = await sb
          .from('restaurant_order_items')
          .select('id')
          .eq('order_id', (openOrd as any).id)
          .not('kot_status', 'in', '(new,void)')
          .limit(1);
        if (sentErr) { toast.error('Error checking items: ' + sentErr.message); return; }
        if (sentItems && sentItems.length) {
          toast.error('Cannot clear: items already sent to kitchen');
          return;
        }
        const { error: delErr } = await sb.from('restaurant_order_items').delete().eq('order_id', (openOrd as any).id);
        if (delErr) { toast.error('Error deleting items: ' + delErr.message); return; }
        const { error: voidErr } = await sb.from('restaurant_orders').update({ status: 'void' }).eq('id', (openOrd as any).id);
        if (voidErr) { toast.error('Error voiding order: ' + voidErr.message); return; }
      }

      const { error: tblErr } = await sb.from('restaurant_tables').update({ status: 'free' }).eq('id', t.id);
      if (tblErr) { toast.error('Error updating table: ' + tblErr.message); return; }

      if (order?.table_id === t.id) clearOrder();
      toast.success(`Table ${t.name} cleared`);
      await reload();
    } catch (err: any) {
      toast.error('Clear failed: ' + (err?.message || String(err)));
    }
  }

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-50 via-orange-50/30 to-amber-50/40 dark:from-slate-950 dark:via-slate-900 dark:to-orange-950/20">
      {/* Top bar */}
      <div className="px-4 py-3 border-b bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl flex items-center gap-3 flex-wrap shadow-sm">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-lg shadow-orange-500/30">
            <UtensilsCrossed className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="font-bold text-sm leading-tight">Restaurant POS</div>
            <div className="text-[10px] text-muted-foreground">Live service</div>
          </div>
        </div>

        <Tabs value={orderType} onValueChange={(v) => { setOrderType(v as any); if (order && order.type !== v) clearOrder(); }} className="ml-2">
          <TabsList className="bg-slate-100/80 dark:bg-slate-800/60 rounded-full p-1 h-10">
            <TabsTrigger value="dine_in" className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow data-[state=active]:text-orange-600"><Users className="h-4 w-4 mr-1.5" /> Dine-in</TabsTrigger>
            <TabsTrigger value="takeaway" className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow data-[state=active]:text-orange-600"><ShoppingBag className="h-4 w-4 mr-1.5" /> Takeaway</TabsTrigger>
            <TabsTrigger value="delivery" className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow data-[state=active]:text-orange-600"><Bike className="h-4 w-4 mr-1.5" /> Delivery</TabsTrigger>
          </TabsList>
        </Tabs>

        {order && (
          <Badge className="ml-1 bg-gradient-to-r from-orange-500 to-red-600 text-white border-0 shadow">#{order.order_no}</Badge>
        )}
        {(orderType === 'takeaway' || orderType === 'delivery') && !order && (
          <Button size="sm" className="bg-gradient-to-r from-orange-500 to-red-600 hover:opacity-90 text-white border-0 rounded-full" onClick={() => setCustomerOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> New {orderType}
          </Button>
        )}

        <div className="ml-auto flex gap-2">
          <RestaurantNavButtons />
          <Link to="/admin/restaurant/settings">
            <Button variant="outline" size="sm" className="rounded-full"><SettingsIcon className="h-4 w-4 mr-1" /> Settings</Button>
          </Link>
          <Button variant="outline" size="sm" onClick={sendKOT} disabled={!order} className="rounded-full border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30 text-amber-700 dark:text-amber-300">
            <ChefHat className="h-4 w-4 mr-1" /> KOT <kbd className="ml-1.5 text-[10px] opacity-60">F2</kbd>
          </Button>
          <Button variant="outline" size="sm" onClick={printBill} disabled={!order} className="rounded-full">
            <Printer className="h-4 w-4 mr-1" /> Bill <kbd className="ml-1.5 text-[10px] opacity-60">F3</kbd>
          </Button>
          <Button size="sm" onClick={() => setPayOpen(true)} disabled={!order || !orderItems.length} className="rounded-full bg-gradient-to-r from-emerald-500 to-green-600 hover:opacity-90 text-white border-0 shadow-lg shadow-emerald-500/30">
            <CreditCard className="h-4 w-4 mr-1" /> Pay <kbd className="ml-1.5 text-[10px] opacity-70">F4</kbd>
          </Button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-12 gap-4 p-4 overflow-hidden">
        {/* Order ticket */}
        <div className="col-span-5 rounded-2xl bg-white/80 dark:bg-slate-900/70 backdrop-blur-xl shadow-xl shadow-slate-200/40 dark:shadow-black/30 border border-white/40 dark:border-white/5 flex flex-col overflow-hidden">
          <div className="p-3 border-b border-slate-200/60 dark:border-slate-800 bg-gradient-to-r from-slate-50 to-orange-50/50 dark:from-slate-900 dark:to-orange-950/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-orange-500" />
              <span className="font-bold text-sm">Order Ticket</span>
            </div>
            {order && <span className="text-xs text-muted-foreground">{orderItems.length} items</span>}
          </div>
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-2">
              {/* Dine-in: no table selected prompt */}
              {orderType === 'dine_in' && !order && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-950/40 dark:to-amber-950/40 flex items-center justify-center mb-3">
                    <Receipt className="h-7 w-7 text-orange-400" />
                  </div>
                  <p className="text-sm font-medium">New order</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-[220px]">Tap a menu item to start — you'll be asked to pick a table.</p>
                  <Button size="sm" variant="outline" className="mt-3 rounded-full" onClick={() => setTablePickerOpen(true)}>
                    <Users className="h-4 w-4 mr-1" /> Choose table
                  </Button>
                </div>
              )}
              {/* Takeaway / delivery: no order prompt */}
              {(orderType === 'takeaway' || orderType === 'delivery') && !order && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-950/40 dark:to-amber-950/40 flex items-center justify-center mb-3">
                    <Receipt className="h-7 w-7 text-orange-400" />
                  </div>
                  <p className="text-sm font-medium">No order started</p>
                  <p className="text-xs text-muted-foreground mt-1">Tap "New {orderType.replace('_', '-')}" above or add items from the menu.</p>
                </div>
              )}
              {orderItems.map(oi => (
                <div key={oi.id} className="group flex items-center gap-2 text-sm rounded-xl p-2.5 bg-slate-50/80 dark:bg-slate-800/40 hover:bg-white dark:hover:bg-slate-800 border border-transparent hover:border-orange-200 dark:hover:border-orange-900 transition">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{oi.name}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <span>{Number(oi.unit_price).toFixed(0)} each</span>
                      {oi.kot_status && oi.kot_status !== 'new' && <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-amber-300 text-amber-700">{oi.kot_status}</Badge>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 bg-white dark:bg-slate-900 rounded-full border border-slate-200 dark:border-slate-700 p-0.5">
                    <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full" onClick={() => changeQty(oi, -1)}><Minus className="h-3 w-3" /></Button>
                    <span className="w-6 text-center font-bold text-sm">{Number(oi.qty)}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full" onClick={() => changeQty(oi, 1)}><Plus className="h-3 w-3" /></Button>
                  </div>
                  <span className="w-16 text-right font-bold text-orange-600 dark:text-orange-400">{(oi.qty * oi.unit_price).toFixed(0)}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive opacity-0 group-hover:opacity-100 transition" onClick={() => removeItem(oi)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              ))}
              {orderItems.length === 0 && order && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-950/40 dark:to-amber-950/40 flex items-center justify-center mb-3">
                    <Receipt className="h-7 w-7 text-orange-400" />
                  </div>
                  <p className="text-sm font-medium">No items yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Tap items from the menu to add them.</p>
                </div>
              )}
            </div>
          </ScrollArea>
          {order && (
            <div className="p-4 border-t border-slate-200/60 dark:border-slate-800 bg-gradient-to-br from-white via-orange-50/40 to-amber-50/40 dark:from-slate-900 dark:via-orange-950/10 dark:to-amber-950/10 space-y-1.5">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Subtotal</span><span>{Number(order.subtotal).toFixed(0)}</span>
              </div>
              {order.discount > 0 && <div className="flex justify-between text-sm text-emerald-600"><span>Discount</span><span>-{Number(order.discount).toFixed(0)}</span></div>}
              <div className="flex justify-between items-baseline pt-1.5 border-t border-dashed border-slate-300 dark:border-slate-700">
                <span className="font-bold">Total</span>
                <span className="text-2xl font-black bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">{Number(order.total).toFixed(0)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Menu */}
        <div className="col-span-7 rounded-2xl bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl shadow-xl shadow-slate-200/40 dark:shadow-black/20 border border-white/40 dark:border-white/5 flex flex-col overflow-hidden">

          <div className="p-3 border-b border-slate-200/60 dark:border-slate-800 flex gap-2 items-center bg-gradient-to-r from-white to-slate-50 dark:from-slate-900 dark:to-slate-800/50">
            <div className="relative flex-1">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search menu..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 pl-9 rounded-full bg-slate-100/70 dark:bg-slate-800/50 border-0 focus-visible:ring-2 focus-visible:ring-orange-400" />
            </div>
          </div>
          <div className="px-3 py-2 border-b border-slate-200/60 dark:border-slate-800 overflow-x-auto flex gap-1.5 scrollbar-thin">
            {cats.map(c => (
              <Button key={c.id} size="sm" variant="ghost"
                onClick={() => setActiveCat(c.id)}
                className={`rounded-full font-semibold transition-all whitespace-nowrap ${
                  activeCat === c.id
                    ? 'bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-lg shadow-orange-500/30 hover:opacity-90 hover:text-white'
                    : 'bg-slate-100 dark:bg-slate-800 hover:bg-orange-100 dark:hover:bg-orange-950/30'
                }`}>
                {c.name}
              </Button>
            ))}
            {!cats.length && <span className="text-xs text-muted-foreground p-2">No menu yet. Set up in Restaurant Menu.</span>}
          </div>
          <ScrollArea className="flex-1">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 p-3">
              {visible.map((it, idx) => {
                const colors = [
                  'from-orange-400 to-red-500',
                  'from-amber-400 to-orange-500',
                  'from-rose-400 to-pink-500',
                  'from-emerald-400 to-teal-500',
                  'from-sky-400 to-blue-500',
                  'from-violet-400 to-purple-500',
                ];
                const grad = colors[idx % colors.length];
                return (
                  <button key={it.id} onClick={() => addItem(it)}
                    className="group relative overflow-hidden rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 shadow-sm hover:shadow-xl hover:-translate-y-0.5 active:scale-95 transition-all duration-200 text-left">
                    <div className={`h-20 bg-gradient-to-br ${grad} relative flex items-center justify-center`}>
                      <UtensilsCrossed className="h-8 w-8 text-white/80 drop-shadow group-hover:scale-110 transition" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                    </div>
                    <div className="p-2.5">
                      <div className="font-semibold text-sm leading-tight line-clamp-2 min-h-[2.5rem]">{it.name}</div>
                      <div className="flex items-baseline justify-between mt-1.5">
                        <span className="font-black text-orange-600 dark:text-orange-400">{Number(it.price).toFixed(0)}</span>
                        <span className="h-6 w-6 rounded-full bg-orange-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow-lg shadow-orange-500/40">
                          <Plus className="h-3.5 w-3.5" />
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
              {visible.length === 0 && cats.length > 0 && (
                <div className="col-span-full flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                  <Sparkles className="h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">No items match</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Customer dialog for takeaway/delivery */}
      <CustomerDialog open={customerOpen} onOpenChange={setCustomerOpen} type={orderType}
        onSubmit={(d) => { setCustomerOpen(false); openOrder(null, orderType, d); }} />

      {/* Guest count dialog for new dine-in */}
      <GuestCountDialog
        open={guestDialog.open}
        table={guestDialog.table}
        onOpenChange={(o) => setGuestDialog(prev => ({ ...prev, open: o }))}
        onConfirm={async (n) => {
          const t = guestDialog.table;
          setGuestDialog({ table: null, open: false });
          if (!t) return;
          await openOrder(t.id, 'dine_in', { guest_count: n } as any);
        }}
      />

      {/* Table picker dialog (when adding an item without a table) */}
      <TablePickerDialog
        open={tablePickerOpen}
        tables={tables}
        tableOrders={tableOrders}
        onOpenChange={(o) => { setTablePickerOpen(o); if (!o) setPendingItem(null); }}
        onPick={async (t) => {
          setTablePickerOpen(false);
          const itemToAdd = pendingItem;
          setPendingItem(null);
          if (tableOrders[t.id]) {
            await openOrder(t.id, 'dine_in');
          } else {
            // Default 2 guests; user can adjust via floating badge
            await openOrder(t.id, 'dine_in', { guest_count: Math.min(2, t.seats || 2) } as any);
          }
          if (itemToAdd) setTimeout(() => addItem(itemToAdd), 120);
        }}
      />

      {/* Inline editable guest count badge when order has table */}
      {order && order.table_id && (
        <FloatingGuestBadge
          count={order.guest_count || 1}
          seats={tables.find(t => t.id === order.table_id)?.seats || 0}
          onChange={updateGuestCount}
        />
      )}

      {/* Payment dialog */}
      <PaymentDialog open={payOpen} onOpenChange={setPayOpen} order={order}
        onPaid={async (payments) => {
          if (!order) return;
          for (const p of payments) {
            await sb.from('restaurant_payments').insert({ order_id: order.id, method: p.method, amount: p.amount, paid_by: session?.id || null });
          }
          await sb.from('restaurant_orders').update({ status: 'paid' }).eq('id', order.id);
          await printBill();
          toast.success('Payment recorded');
          setPayOpen(false);
          clearOrder();
        }} />
    </div>
  );
}

function GuestCountDialog({ open, onOpenChange, table, onConfirm }: { open: boolean; onOpenChange: (b: boolean) => void; table: RTable | null; onConfirm: (n: number) => void }) {
  const [n, setN] = useState(2);
  useEffect(() => { if (open) setN(Math.min(2, table?.seats || 2)); }, [open, table]);
  if (!table) return null;
  const max = Math.max(table.seats || 12, 12);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-orange-500" /> Table {table.name} — Guests</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">How many guests are seated? (Capacity: {table.seats})</p>
          <div className="flex items-center justify-center gap-3">
            <Button size="icon" variant="outline" className="h-12 w-12 rounded-full" onClick={() => setN(Math.max(1, n - 1))}><Minus className="h-5 w-5" /></Button>
            <div className="text-5xl font-black w-20 text-center bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">{n}</div>
            <Button size="icon" variant="outline" className="h-12 w-12 rounded-full" onClick={() => setN(Math.min(max, n + 1))}><Plus className="h-5 w-5" /></Button>
          </div>
          <div className="grid grid-cols-6 gap-1.5">
            {Array.from({ length: Math.min(max, 12) }, (_, i) => i + 1).map(v => (
              <Button key={v} size="sm" variant={n === v ? 'default' : 'outline'} onClick={() => setN(v)} className={n === v ? 'bg-gradient-to-r from-orange-500 to-red-600 text-white border-0' : ''}>{v}</Button>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => onConfirm(n)} className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-white border-0">Seat & open order</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FloatingGuestBadge({ count, seats, onChange }: { count: number; seats: number; onChange: (n: number) => void }) {
  return (
    <div className="fixed bottom-4 left-4 z-30 flex items-center gap-1.5 bg-white dark:bg-slate-900 shadow-xl rounded-full pl-3 pr-1.5 py-1.5 border border-orange-200 dark:border-orange-900">
      <Users className="h-4 w-4 text-orange-500" />
      <span className="text-xs font-semibold">Guests</span>
      <Button size="icon" variant="ghost" className="h-6 w-6 rounded-full" onClick={() => onChange(Math.max(1, count - 1))}><Minus className="h-3 w-3" /></Button>
      <span className="font-bold w-6 text-center">{count}</span>
      <Button size="icon" variant="ghost" className="h-6 w-6 rounded-full" onClick={() => onChange(count + 1)}><Plus className="h-3 w-3" /></Button>
      {seats > 0 && <span className="text-[10px] text-muted-foreground pr-1">/ {seats}</span>}
    </div>
  );
}

function CustomerDialog({ open, onOpenChange, type, onSubmit }: { open: boolean; onOpenChange: (b: boolean) => void; type: string; onSubmit: (d: any) => void }) {
  return CustomerDialogImpl({ open, onOpenChange, type, onSubmit });
}

function TablePickerDialog({ open, onOpenChange, tables, tableOrders, onPick }: { open: boolean; onOpenChange: (b: boolean) => void; tables: RTable[]; tableOrders: Record<string, { total: number; guest_count: number; order_no: string }>; onPick: (t: RTable) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-orange-500" /> Select a table</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 max-h-[60vh] overflow-y-auto p-1">
          {tables.map(t => {
            const occ = !!tableOrders[t.id];
            return (
              <button key={t.id} onClick={() => onPick(t)}
                className={`relative rounded-xl p-3 border text-left transition active:scale-95 ${
                  occ
                    ? 'bg-orange-50 dark:bg-orange-950/30 border-orange-300 dark:border-orange-800 hover:bg-orange-100'
                    : 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900 hover:bg-emerald-100'
                }`}>
                <div className="font-bold text-sm">{t.name}</div>
                <div className="text-[10px] text-muted-foreground">Seats {t.seats}</div>
                {occ && <div className="text-[10px] font-semibold text-orange-700 dark:text-orange-300 mt-1">In use</div>}
              </button>
            );
          })}
          {!tables.length && <div className="col-span-full text-center text-xs text-muted-foreground py-6">No tables configured.</div>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CustomerDialogImpl({ open, onOpenChange, type, onSubmit }: { open: boolean; onOpenChange: (b: boolean) => void; type: string; onSubmit: (d: any) => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [addr, setAddr] = useState('');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>New {type === 'delivery' ? 'Delivery' : 'Takeaway'} Order</DialogTitle></DialogHeader>
        <div className="space-y-2">
          <Input placeholder="Customer name" value={name} onChange={e => setName(e.target.value)} />
          <Input placeholder="Phone" value={phone} onChange={e => setPhone(e.target.value)} />
          {type === 'delivery' && <Input placeholder="Delivery address" value={addr} onChange={e => setAddr(e.target.value)} />}
        </div>
        <DialogFooter>
          <Button onClick={() => onSubmit({ customer_name: name, customer_phone: phone, delivery_address: addr })}>Start Order</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PaymentDialog({ open, onOpenChange, order, onPaid }: { open: boolean; onOpenChange: (b: boolean) => void; order: Order | null; onPaid: (p: { method: string; amount: number }[]) => void }) {
  const total = order?.total || 0;
  const [payments, setPayments] = useState<{ method: string; amount: number }[]>([{ method: 'cash', amount: 0 }]);
  useEffect(() => { if (open) setPayments([{ method: 'cash', amount: total }]); }, [open, total]);
  const paid = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const remaining = total - paid;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Payment — {total.toFixed(2)}</DialogTitle></DialogHeader>
        <div className="space-y-2">
          {payments.map((p, idx) => (
            <div key={idx} className="flex gap-2">
              <select value={p.method} onChange={e => setPayments(prev => prev.map((q, i) => i === idx ? { ...q, method: e.target.value } : q))} className="border rounded px-2 bg-background">
                <option value="cash">Cash</option>
                <option value="mobile">Mobile Money</option>
                <option value="card">Card</option>
                <option value="credit">Credit</option>
              </select>
              <Input type="number" value={p.amount} onChange={e => setPayments(prev => prev.map((q, i) => i === idx ? { ...q, amount: Number(e.target.value) } : q))} />
              {payments.length > 1 && <Button variant="ghost" size="icon" onClick={() => setPayments(prev => prev.filter((_, i) => i !== idx))}><Trash2 className="h-4 w-4" /></Button>}
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setPayments(prev => [...prev, { method: 'cash', amount: Math.max(0, remaining) }])}>+ Add split</Button>
          <div className="flex justify-between text-sm pt-2"><span>Paid:</span><span>{paid.toFixed(2)}</span></div>
          <div className={`flex justify-between font-semibold ${Math.abs(remaining) < 0.01 ? 'text-emerald-600' : 'text-destructive'}`}><span>{remaining >= 0 ? 'Remaining:' : 'Change:'}</span><span>{Math.abs(remaining).toFixed(2)}</span></div>
        </div>
        <DialogFooter>
          <Button onClick={() => onPaid(payments.filter(p => p.amount > 0))} disabled={paid < total - 0.01}>Confirm Payment</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}