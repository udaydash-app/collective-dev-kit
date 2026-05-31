import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, Plus, Minus, Printer, ChefHat, CreditCard, Users, Bike, ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';

async function printHtml(html: string) {
  const w = window.open('', '_blank', 'width=400,height=600');
  if (!w) return;
  w.document.write(`<html><head><title>Print</title></head><body>${html}<script>window.onload=()=>{window.print();setTimeout(()=>window.close(),200)}</script></body></html>`);
  w.document.close();
}

// Supabase types aren't regenerated yet for restaurant_* tables; use a loose alias.
const sb: any = supabase;

type Cat = { id: string; name: string; color: string | null };
type Item = { id: string; category_id: string | null; name: string; price: number; image_url: string | null; is_available: boolean; kot_printer: string };
type RTable = { id: string; name: string; seats: number; status: string; x: number; y: number; shape: string };
type OrderItem = { id?: string; menu_item_id: string; name: string; qty: number; unit_price: number; note?: string; kot_status?: string; kot_batch?: number };
type Order = { id: string; order_no: string; type: string; table_id: string | null; status: string; subtotal: number; tax: number; service_charge: number; discount: number; total: number; customer_name?: string; customer_phone?: string; delivery_address?: string };

export default function RestaurantPOS() {
  const [cats, setCats] = useState<Cat[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [tables, setTables] = useState<RTable[]>([]);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [orderType, setOrderType] = useState<'dine_in' | 'takeaway' | 'delivery'>('dine_in');
  const [order, setOrder] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [search, setSearch] = useState('');
  const [payOpen, setPayOpen] = useState(false);
  const [customerOpen, setCustomerOpen] = useState(false);

  const session = (() => { try { return JSON.parse(localStorage.getItem('offline_pos_session') || 'null'); } catch { return null; } })();

  useEffect(() => { reload(); }, []);
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
    const [c, i, t] = await Promise.all([
      sb.from('restaurant_menu_categories').select('*').eq('is_active', true).order('sort_order'),
      sb.from('restaurant_menu_items').select('*').eq('is_available', true).order('sort_order'),
      sb.from('restaurant_tables').select('*').order('name'),
    ]);
    setCats((c.data as any) || []);
    setItems((i.data as any) || []);
    setTables((t.data as any) || []);
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

  async function addItem(it: Item) {
    if (!order) {
      if (orderType === 'dine_in') { toast.error('Select a table first'); return; }
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
    if (data) setOrder(data as any);
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
    // Print KOT
    const html = `
      <div style="font-family: monospace; padding: 8px; width: 72mm;">
        <h2 style="text-align:center;margin:0">*** KOT ***</h2>
        <div>Order: ${order.order_no}</div>
        <div>Type: ${order.type.toUpperCase()}${order.table_id ? ' • Table: ' + (tables.find(t => t.id === order.table_id)?.name || '') : ''}</div>
        <div>Batch #${nextBatch} • ${new Date().toLocaleTimeString()}</div>
        <hr/>
        ${newItems.map(n => `<div style="font-size:14px;font-weight:bold">${n.qty} × ${n.name}</div>${n.note ? `<div style="font-size:11px;font-style:italic">→ ${n.note}</div>` : ''}`).join('')}
      </div>`;
    try { await printHtml(html); } catch { window.print(); }
    setOrderItems(prev => prev.map(p => p.kot_status === 'new' ? { ...p, kot_status: 'sent', kot_batch: nextBatch } : p));
    toast.success('Sent to kitchen');
  }

  async function printBill() {
    if (!order) return;
    const html = `
      <div style="font-family: monospace; padding: 8px; width: 72mm;">
        <h2 style="text-align:center;margin:0">RESTAURANT BILL</h2>
        <div>Order: ${order.order_no}</div>
        <div>${new Date().toLocaleString()}</div>
        ${order.table_id ? `<div>Table: ${tables.find(t => t.id === order.table_id)?.name || ''}</div>` : ''}
        <hr/>
        ${orderItems.filter(o => o.kot_status !== 'void').map(o => `<div style="display:grid;grid-template-columns:1fr auto;gap:6px"><span>${o.qty} × ${o.name}</span><span>${(o.qty * o.unit_price).toFixed(2)}</span></div>`).join('')}
        <hr/>
        <div style="display:flex;justify-content:space-between"><span>Subtotal</span><span>${order.subtotal.toFixed(2)}</span></div>
        ${order.discount > 0 ? `<div style="display:flex;justify-content:space-between"><span>Discount</span><span>-${order.discount.toFixed(2)}</span></div>` : ''}
        ${order.service_charge > 0 ? `<div style="display:flex;justify-content:space-between"><span>Service</span><span>${order.service_charge.toFixed(2)}</span></div>` : ''}
        ${order.tax > 0 ? `<div style="display:flex;justify-content:space-between"><span>Tax</span><span>${order.tax.toFixed(2)}</span></div>` : ''}
        <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:16px"><span>TOTAL</span><span>${order.total.toFixed(2)}</span></div>
        <p style="text-align:center;margin-top:8px">Thank you!</p>
      </div>`;
    try { await printHtml(html); } catch { window.print(); }
  }

  function clearOrder() {
    setOrder(null);
    setOrderItems([]);
    reload();
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Order-type tabs */}
      <div className="p-3 border-b flex items-center gap-2 flex-wrap">
        <Tabs value={orderType} onValueChange={(v) => { setOrderType(v as any); if (order && order.type !== v) clearOrder(); }}>
          <TabsList>
            <TabsTrigger value="dine_in"><Users className="h-4 w-4 mr-1" /> Dine-in</TabsTrigger>
            <TabsTrigger value="takeaway"><ShoppingBag className="h-4 w-4 mr-1" /> Takeaway</TabsTrigger>
            <TabsTrigger value="delivery"><Bike className="h-4 w-4 mr-1" /> Delivery</TabsTrigger>
          </TabsList>
        </Tabs>
        {order && (
          <Badge variant="secondary" className="ml-2">Order {order.order_no}</Badge>
        )}
        {(orderType === 'takeaway' || orderType === 'delivery') && !order && (
          <Button size="sm" onClick={() => setCustomerOpen(true)}>+ New {orderType}</Button>
        )}
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={sendKOT} disabled={!order}><ChefHat className="h-4 w-4 mr-1" /> KOT (F2)</Button>
          <Button variant="outline" size="sm" onClick={printBill} disabled={!order}><Printer className="h-4 w-4 mr-1" /> Bill (F3)</Button>
          <Button size="sm" onClick={() => setPayOpen(true)} disabled={!order || !orderItems.length}><CreditCard className="h-4 w-4 mr-1" /> Pay (F4)</Button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-12 gap-3 p-3 overflow-hidden">
        {/* Tables / floor plan */}
        {orderType === 'dine_in' && (
          <div className="col-span-3 border rounded-lg p-2 overflow-auto">
            <h3 className="font-semibold mb-2">Tables</h3>
            <div className="grid grid-cols-2 gap-2">
              {tables.map(t => (
                <button key={t.id}
                  onClick={() => openOrder(t.id, 'dine_in')}
                  className={`p-3 rounded-lg border text-center text-sm font-medium transition ${
                    order?.table_id === t.id ? 'bg-primary text-primary-foreground border-primary' :
                    t.status === 'occupied' ? 'bg-orange-100 border-orange-300 text-orange-900 dark:bg-orange-900/30' :
                    'bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-900/20'
                  }`}>
                  <div>{t.name}</div>
                  <div className="text-xs opacity-70">{t.seats} seats</div>
                </button>
              ))}
              {tables.length === 0 && <div className="col-span-2 text-xs text-muted-foreground p-4">No tables. Add in Restaurant Tables.</div>}
            </div>
          </div>
        )}

        {/* Order ticket */}
        <div className={`${orderType === 'dine_in' ? 'col-span-4' : 'col-span-5'} border rounded-lg flex flex-col overflow-hidden`}>
          <div className="p-2 border-b bg-muted/30 font-semibold text-sm">Current Order</div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {orderItems.map(oi => (
                <div key={oi.id} className="flex items-center gap-2 text-sm border rounded p-2">
                  <div className="flex-1">
                    <div className="font-medium">{oi.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {Number(oi.unit_price).toFixed(2)} each
                      {oi.kot_status && oi.kot_status !== 'new' && <Badge variant="outline" className="ml-2 text-xs">{oi.kot_status}</Badge>}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => changeQty(oi, -1)}><Minus className="h-3 w-3" /></Button>
                  <span className="w-8 text-center">{Number(oi.qty)}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => changeQty(oi, 1)}><Plus className="h-3 w-3" /></Button>
                  <span className="w-16 text-right font-semibold">{(oi.qty * oi.unit_price).toFixed(2)}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeItem(oi)}><Trash2 className="h-3 w-3" /></Button>
                </div>
              ))}
              {!orderItems.length && <p className="text-sm text-muted-foreground p-4 text-center">Pick a table / customer and add items</p>}
            </div>
          </ScrollArea>
          {order && (
            <div className="p-3 border-t bg-muted/20 space-y-1 text-sm">
              <div className="flex justify-between"><span>Subtotal</span><span>{Number(order.subtotal).toFixed(2)}</span></div>
              <div className="flex justify-between text-lg font-bold"><span>Total</span><span>{Number(order.total).toFixed(2)}</span></div>
            </div>
          )}
        </div>

        {/* Menu */}
        <div className={`${orderType === 'dine_in' ? 'col-span-5' : 'col-span-7'} border rounded-lg flex flex-col overflow-hidden`}>
          <div className="p-2 border-b flex gap-2 items-center">
            <Input placeholder="Search menu..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-8" />
          </div>
          <div className="px-2 py-1 border-b overflow-x-auto flex gap-1">
            {cats.map(c => (
              <Button key={c.id} size="sm" variant={activeCat === c.id ? 'default' : 'outline'} onClick={() => setActiveCat(c.id)}>
                {c.name}
              </Button>
            ))}
            {!cats.length && <span className="text-xs text-muted-foreground p-2">No menu yet. Set up in Restaurant Menu.</span>}
          </div>
          <ScrollArea className="flex-1">
            <div className="grid grid-cols-3 gap-2 p-2">
              {visible.map(it => (
                <Card key={it.id} onClick={() => addItem(it)} className="p-3 cursor-pointer hover:bg-accent transition active:scale-95">
                  <div className="font-medium text-sm leading-tight">{it.name}</div>
                  <div className="text-primary font-bold mt-1">{Number(it.price).toFixed(2)}</div>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Customer dialog for takeaway/delivery */}
      <CustomerDialog open={customerOpen} onOpenChange={setCustomerOpen} type={orderType}
        onSubmit={(d) => { setCustomerOpen(false); openOrder(null, orderType, d); }} />

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

function CustomerDialog({ open, onOpenChange, type, onSubmit }: { open: boolean; onOpenChange: (b: boolean) => void; type: string; onSubmit: (d: any) => void }) {
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