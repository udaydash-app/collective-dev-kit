import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Plus, Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';

const sb: any = supabase;

export default function RestaurantIngredients() {
  const [items, setItems] = useState<any[]>([]);
  const [add, setAdd] = useState({ name: '', unit: 'g', min_stock: '0' });
  const [search, setSearch] = useState('');

  useEffect(() => { reload(); }, []);
  async function reload() {
    const { data } = await sb.from('restaurant_ingredients').select('*').order('name');
    setItems(data || []);
  }

  async function create() {
    if (!add.name.trim()) return;
    const { error } = await sb.from('restaurant_ingredients').insert({
      name: add.name.trim(), unit: add.unit.trim() || 'unit', min_stock: Number(add.min_stock) || 0,
    });
    if (error) return toast.error(error.message);
    setAdd({ name: '', unit: 'g', min_stock: '0' });
    reload();
  }

  async function del(id: string) {
    if (!confirm('Delete ingredient?')) return;
    const { error } = await sb.from('restaurant_ingredients').delete().eq('id', id);
    if (error) return toast.error(error.message);
    reload();
  }

  async function updateField(id: string, field: string, value: any) {
    await sb.from('restaurant_ingredients').update({ [field]: value }).eq('id', id);
    reload();
  }

  const filtered = items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Ingredients</h1>
        <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
      </div>

      <Card className="p-3">
        <div className="grid grid-cols-12 gap-2">
          <Input className="col-span-5" placeholder="Ingredient name (e.g. Chicken breast)" value={add.name} onChange={e => setAdd({ ...add, name: e.target.value })} />
          <Input className="col-span-2" placeholder="Unit (g, ml, pcs)" value={add.unit} onChange={e => setAdd({ ...add, unit: e.target.value })} />
          <Input className="col-span-2" type="number" placeholder="Min stock" value={add.min_stock} onChange={e => setAdd({ ...add, min_stock: e.target.value })} />
          <Button className="col-span-3" onClick={create}><Plus className="h-4 w-4 mr-1" /> Add</Button>
        </div>
      </Card>

      <Card className="p-0 overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-2">Name</th>
              <th className="text-left p-2">Unit</th>
              <th className="text-right p-2">Stock</th>
              <th className="text-right p-2">Avg cost</th>
              <th className="text-right p-2">Last cost</th>
              <th className="text-right p-2">Stock value</th>
              <th className="text-right p-2">Min</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(i => {
              const low = Number(i.stock) <= Number(i.min_stock);
              return (
                <tr key={i.id} className="border-t">
                  <td className="p-2">
                    <Input defaultValue={i.name} onBlur={e => e.target.value !== i.name && updateField(i.id, 'name', e.target.value)} className="h-8" />
                  </td>
                  <td className="p-2"><Input defaultValue={i.unit} onBlur={e => e.target.value !== i.unit && updateField(i.id, 'unit', e.target.value)} className="h-8 w-20" /></td>
                  <td className={`p-2 text-right ${low ? 'text-destructive font-semibold' : ''}`}>
                    {low && <AlertTriangle className="inline h-3 w-3 mr-1" />}
                    {Number(i.stock).toFixed(2)}
                  </td>
                  <td className="p-2 text-right">{formatCurrency(i.avg_cost)}</td>
                  <td className="p-2 text-right text-muted-foreground">{formatCurrency(i.last_cost)}</td>
                  <td className="p-2 text-right font-semibold">{formatCurrency(Number(i.stock) * Number(i.avg_cost))}</td>
                  <td className="p-2 text-right"><Input defaultValue={i.min_stock} type="number" onBlur={e => Number(e.target.value) !== Number(i.min_stock) && updateField(i.id, 'min_stock', Number(e.target.value))} className="h-8 w-20 text-right" /></td>
                  <td className="p-2"><Button variant="ghost" size="icon" className="text-destructive" onClick={() => del(i.id)}><Trash2 className="h-4 w-4" /></Button></td>
                </tr>
              );
            })}
            {!filtered.length && <tr><td colSpan={8} className="text-center p-8 text-muted-foreground">No ingredients. Add some above, then purchase to add stock.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}