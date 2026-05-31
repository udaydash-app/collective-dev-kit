import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { RestaurantNavButtons } from '@/components/layout/RestaurantNavButtons';
import { Trash2, Plus, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

const sb: any = supabase;

export default function RestaurantTables() {
  const [tables, setTables] = useState<any[]>([]);
  const [form, setForm] = useState({ name: '', seats: 4 });

  useEffect(() => { reload(); }, []);
  async function reload() {
    const { data } = await sb.from('restaurant_tables').select('*').order('name');
    setTables(data || []);
  }
  async function add() {
    if (!form.name.trim()) return;
    const { error } = await sb.from('restaurant_tables').insert({ name: form.name, seats: Number(form.seats) || 4 });
    if (error) toast.error(error.message); else { setForm({ name: '', seats: 4 }); reload(); }
  }
  async function del(id: string) {
    await sb.from('restaurant_tables').delete().eq('id', id);
    reload();
  }
  async function update(id: string, patch: any) {
    await sb.from('restaurant_tables').update(patch).eq('id', id);
    reload();
  }

  async function clearTable(t: any) {
    const { count, error: cErr } = await sb
      .from('restaurant_orders')
      .select('id', { count: 'exact', head: true })
      .eq('table_id', t.id)
      .in('status', ['open', 'sent', 'preparing', 'ready']);
    if (cErr) { toast.error(cErr.message); return; }
    if ((count || 0) > 0) {
      toast.error(`Cannot clear: ${count} active order(s) on this table.`);
      return;
    }
    const { error } = await sb.from('restaurant_tables').update({ status: 'free' }).eq('id', t.id);
    if (error) toast.error(error.message);
    else { toast.success(`Table ${t.name} cleared`); reload(); }
  }

  return (
    <div className="p-4 space-y-4 min-h-full">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Table Manager</h1>
        <RestaurantNavButtons />
      </div>
      <Card className="p-4">
        <h2 className="font-semibold mb-3">Add Table</h2>
        <div className="flex gap-2">
          <Input placeholder="Table name (e.g. T1)" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <Input placeholder="Seats" type="number" value={form.seats} onChange={e => setForm({ ...form, seats: Number(e.target.value) })} className="w-32" />
          <Button onClick={add}><Plus className="h-4 w-4 mr-1" /> Add</Button>
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="font-semibold mb-3">Tables ({tables.length})</h2>
        <div className="grid grid-cols-4 gap-3">
          {tables.map(t => (
            <div key={t.id} className={`p-3 rounded-lg border ${
              t.status === 'occupied' ? 'bg-orange-50 border-orange-300 dark:bg-orange-900/20' :
              'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <Input defaultValue={t.name} onBlur={e => e.target.value !== t.name && update(t.id, { name: e.target.value })} className="h-8 font-semibold" />
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => del(t.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span>Seats:</span>
                <Input type="number" defaultValue={t.seats} onBlur={e => Number(e.target.value) !== t.seats && update(t.id, { seats: Number(e.target.value) })} className="h-7 w-16" />
              </div>
              <div className="flex items-center justify-between mt-2">
                <div className="text-xs capitalize text-muted-foreground">Status: {t.status}</div>
                {t.status !== 'free' && (
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => clearTable(t)}>
                    <CheckCircle2 className="h-3 w-3 mr-1" /> Clear
                  </Button>
                )}
              </div>
            </div>
          ))}
          {!tables.length && <p className="col-span-4 text-sm text-muted-foreground text-center py-8">No tables yet.</p>}
        </div>
      </Card>
    </div>
  );
}