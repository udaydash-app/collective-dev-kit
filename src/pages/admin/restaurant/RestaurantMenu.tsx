import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';

const sb: any = supabase;

export default function RestaurantMenu() {
  const [cats, setCats] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [newCat, setNewCat] = useState('');
  const [newItem, setNewItem] = useState({ name: '', price: '' });

  useEffect(() => { reload(); }, []);
  async function reload() {
    const [c, i] = await Promise.all([
      sb.from('restaurant_menu_categories').select('*').order('sort_order'),
      sb.from('restaurant_menu_items').select('*').order('sort_order'),
    ]);
    setCats(c.data || []);
    setItems(i.data || []);
    if (!activeCat && c.data?.length) setActiveCat(c.data[0].id);
  }

  async function addCat() {
    if (!newCat.trim()) return;
    const { error } = await sb.from('restaurant_menu_categories').insert({ name: newCat });
    if (error) toast.error(error.message); else { setNewCat(''); reload(); }
  }
  async function delCat(id: string) {
    if (!confirm('Delete category?')) return;
    await sb.from('restaurant_menu_categories').delete().eq('id', id);
    reload();
  }
  async function addItem() {
    if (!newItem.name.trim() || !activeCat) return;
    const { error } = await sb.from('restaurant_menu_items').insert({
      category_id: activeCat, name: newItem.name, price: Number(newItem.price) || 0,
    });
    if (error) toast.error(error.message); else { setNewItem({ name: '', price: '' }); reload(); }
  }
  async function delItem(id: string) {
    await sb.from('restaurant_menu_items').delete().eq('id', id);
    reload();
  }
  async function updateItem(id: string, patch: any) {
    await sb.from('restaurant_menu_items').update(patch).eq('id', id);
    reload();
  }

  return (
    <div className="p-4 grid grid-cols-12 gap-4 h-full">
      <Card className="col-span-4 p-3 flex flex-col">
        <h2 className="font-semibold mb-2">Categories</h2>
        <div className="flex gap-2 mb-3">
          <Input placeholder="New category" value={newCat} onChange={e => setNewCat(e.target.value)} />
          <Button onClick={addCat}><Plus className="h-4 w-4" /></Button>
        </div>
        <div className="space-y-1 overflow-auto">
          {cats.map(c => (
            <div key={c.id} className={`flex items-center justify-between p-2 rounded cursor-pointer ${activeCat === c.id ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`} onClick={() => setActiveCat(c.id)}>
              <span>{c.name}</span>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={e => { e.stopPropagation(); delCat(c.id); }}><Trash2 className="h-3 w-3" /></Button>
            </div>
          ))}
        </div>
      </Card>

      <Card className="col-span-8 p-3 flex flex-col">
        <h2 className="font-semibold mb-2">Menu Items</h2>
        <div className="flex gap-2 mb-3">
          <Input placeholder="Item name" value={newItem.name} onChange={e => setNewItem({ ...newItem, name: e.target.value })} />
          <Input placeholder="Price" type="number" value={newItem.price} onChange={e => setNewItem({ ...newItem, price: e.target.value })} className="w-32" />
          <Button onClick={addItem} disabled={!activeCat}><Plus className="h-4 w-4 mr-1" /> Add</Button>
        </div>
        <div className="space-y-1 overflow-auto">
          {items.filter(i => i.category_id === activeCat).map(i => (
            <div key={i.id} className="flex items-center gap-2 p-2 border rounded">
              <Input defaultValue={i.name} onBlur={e => e.target.value !== i.name && updateItem(i.id, { name: e.target.value })} className="flex-1" />
              <Input defaultValue={i.price} type="number" onBlur={e => Number(e.target.value) !== Number(i.price) && updateItem(i.id, { price: Number(e.target.value) })} className="w-28" />
              <select value={i.kot_printer} onChange={e => updateItem(i.id, { kot_printer: e.target.value })} className="border rounded px-2 h-9 bg-background">
                <option value="kitchen">Kitchen</option>
                <option value="bar">Bar</option>
                <option value="none">None</option>
              </select>
              <Button variant="ghost" size="icon" onClick={() => updateItem(i.id, { is_available: !i.is_available })}>
                <span className={i.is_available ? 'text-emerald-600' : 'text-muted-foreground'}>●</span>
              </Button>
              <Button variant="ghost" size="icon" className="text-destructive" onClick={() => delItem(i.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
          {!items.filter(i => i.category_id === activeCat).length && <p className="text-sm text-muted-foreground text-center py-8">No items. Add one above.</p>}
        </div>
      </Card>
    </div>
  );
}