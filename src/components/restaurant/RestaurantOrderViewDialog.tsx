import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Pencil, Save, X, Trash2, Loader2 } from 'lucide-react';

const sb: any = supabase;

interface Props {
  orderId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currency?: string;
  onSaved?: () => void;
}

type OI = { id: string; name: string; qty: number; unit_price: number; kot_status?: string };

export function RestaurantOrderViewDialog({ orderId, open, onOpenChange, currency = 'FCFA', onSaved }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [order, setOrder] = useState<any>(null);
  const [items, setItems] = useState<OI[]>([]);
  const [tableName, setTableName] = useState<string>('');

  useEffect(() => {
    if (!open || !orderId) return;
    setEditing(false);
    load();
  }, [open, orderId]);

  async function load() {
    if (!orderId) return;
    setLoading(true);
    const [oRes, iRes] = await Promise.all([
      sb.from('restaurant_orders').select('*').eq('id', orderId).maybeSingle(),
      sb.from('restaurant_order_items').select('*').eq('order_id', orderId).order('created_at'),
    ]);
    setOrder(oRes.data || null);
    setItems((iRes.data as OI[]) || []);
    if (oRes.data?.table_id) {
      const { data: t } = await sb.from('restaurant_tables').select('name').eq('id', oRes.data.table_id).maybeSingle();
      setTableName(t?.name || '');
    } else setTableName('');
    setLoading(false);
  }

  function updateItem(id: string, patch: Partial<OI>) {
    setItems(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p));
  }

  function removeItem(id: string) {
    setItems(prev => prev.filter(p => p.id !== id));
  }

  async function save() {
    if (!order) return;
    setSaving(true);
    try {
      const original = (await sb.from('restaurant_order_items').select('id').eq('order_id', order.id)).data as { id: string }[] || [];
      const keepIds = new Set(items.map(i => i.id));
      const toDelete = original.filter(o => !keepIds.has(o.id)).map(o => o.id);
      if (toDelete.length) await sb.from('restaurant_order_items').delete().in('id', toDelete);
      for (const it of items) {
        await sb.from('restaurant_order_items').update({ qty: Number(it.qty) || 0, unit_price: Number(it.unit_price) || 0 }).eq('id', it.id);
      }
      toast.success('Order updated');
      setEditing(false);
      await load();
      onSaved?.();
    } catch (e: any) {
      toast.error(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  const subtotal = items.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.unit_price) || 0), 0);
  const fmt = (n: number) => `${Number(n).toFixed(0)} ${currency}`;
  const canEdit = order && order.status !== 'paid' && order.status !== 'void';

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) setEditing(false); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-[560px] max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Order {order ? `#${order.order_no}` : ''}
            {order && <Badge variant="outline" className="text-[10px]">{order.status}</Badge>}
            {tableName && <Badge variant="secondary" className="text-[10px]">Table {tableName}</Badge>}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : !order ? (
          <div className="text-sm text-muted-foreground py-6 text-center">Order not found</div>
        ) : (
          <div className="space-y-3">
            <ScrollArea className="max-h-[50vh] pr-2">
              <div className="space-y-2">
                {items.map(it => (
                  <div key={it.id} className="flex items-center gap-2 p-2 rounded-lg border bg-muted/30">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{it.name}</div>
                      {it.kot_status && it.kot_status !== 'new' && (
                        <div className="text-[10px] text-muted-foreground">{it.kot_status}</div>
                      )}
                    </div>
                    {editing ? (
                      <>
                        <Input type="number" min={0} value={it.qty}
                          onChange={(e) => updateItem(it.id, { qty: Number(e.target.value) })}
                          className="w-16 h-8 text-center" />
                        <Input type="number" min={0} value={it.unit_price}
                          onChange={(e) => updateItem(it.id, { unit_price: Number(e.target.value) })}
                          className="w-24 h-8 text-right" />
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeItem(it.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <div className="text-sm w-12 text-center">x{it.qty}</div>
                        <div className="text-sm w-24 text-right font-semibold">{fmt(Number(it.qty) * Number(it.unit_price))}</div>
                      </>
                    )}
                  </div>
                ))}
                {!items.length && <div className="text-xs text-muted-foreground text-center py-6">No items</div>}
              </div>
            </ScrollArea>

            <div className="flex items-center justify-between border-t pt-3">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="text-xl font-black">{fmt(editing ? subtotal : Number(order.total) || subtotal)}</span>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              {editing ? (
                <>
                  <Button variant="outline" onClick={() => { setEditing(false); load(); }} disabled={saving}>
                    <X className="h-4 w-4 mr-1" /> Cancel
                  </Button>
                  <Button onClick={save} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />} Save
                  </Button>
                </>
              ) : (
                <Button onClick={() => setEditing(true)} disabled={!canEdit}>
                  <Pencil className="h-4 w-4 mr-1" /> Edit
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}