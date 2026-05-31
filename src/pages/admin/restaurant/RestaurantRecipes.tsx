import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';

const sb: any = supabase;

export default function RestaurantRecipes() {
  const [items, setItems] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [recipes, setRecipes] = useState<any[]>([]);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [add, setAdd] = useState({ product_id: '', quantity: '1', unit: 'unit' });

  useEffect(() => { reload(); }, []);
  async function reload() {
    const [i, p, r] = await Promise.all([
      sb.from('restaurant_menu_items').select('*').order('name'),
      sb.from('products').select('id,name,stock').order('name').limit(2000),
      sb.from('restaurant_recipes').select('*'),
    ]);
    setItems(i.data || []);
    setProducts(p.data || []);
    setRecipes(r.data || []);
    if (!selectedItem && i.data?.length) setSelectedItem(i.data[0].id);
  }
  async function addRecipe() {
    if (!selectedItem || !add.product_id) return;
    const { error } = await sb.from('restaurant_recipes').insert({
      menu_item_id: selectedItem, product_id: add.product_id,
      quantity: Number(add.quantity) || 1, unit: add.unit,
    });
    if (error) toast.error(error.message); else { setAdd({ product_id: '', quantity: '1', unit: 'unit' }); reload(); }
  }
  async function del(id: string) {
    await sb.from('restaurant_recipes').delete().eq('id', id);
    reload();
  }

  const itemRecipes = recipes.filter(r => r.menu_item_id === selectedItem);

  return (
    <div className="p-4 grid grid-cols-12 gap-4 h-full">
      <Card className="col-span-4 p-3 overflow-auto">
        <h2 className="font-semibold mb-2">Menu Items</h2>
        <div className="space-y-1">
          {items.map(i => (
            <button key={i.id} onClick={() => setSelectedItem(i.id)}
              className={`w-full text-left p-2 rounded ${selectedItem === i.id ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}>
              {i.name}
              <span className="text-xs ml-2 opacity-70">({recipes.filter(r => r.menu_item_id === i.id).length} ing.)</span>
            </button>
          ))}
        </div>
      </Card>
      <Card className="col-span-8 p-3 overflow-auto">
        <h2 className="font-semibold mb-2">Recipe Ingredients</h2>
        <div className="flex gap-2 mb-3">
          <select value={add.product_id} onChange={e => setAdd({ ...add, product_id: e.target.value })} className="flex-1 border rounded px-2 h-9 bg-background">
            <option value="">Select product...</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <Input type="number" value={add.quantity} onChange={e => setAdd({ ...add, quantity: e.target.value })} className="w-24" placeholder="Qty" />
          <Input value={add.unit} onChange={e => setAdd({ ...add, unit: e.target.value })} className="w-24" placeholder="Unit" />
          <Button onClick={addRecipe} disabled={!selectedItem}><Plus className="h-4 w-4" /></Button>
        </div>
        <div className="space-y-1">
          {itemRecipes.map(r => {
            const prod = products.find(p => p.id === r.product_id);
            return (
              <div key={r.id} className="flex items-center gap-2 border rounded p-2">
                <div className="flex-1">{prod?.name || r.product_id}</div>
                <div className="text-sm text-muted-foreground">{r.quantity} {r.unit}</div>
                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => del(r.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            );
          })}
          {!itemRecipes.length && <p className="text-sm text-muted-foreground text-center py-8">No ingredients linked. Stock won't deduct on sale.</p>}
        </div>
      </Card>
    </div>
  );
}