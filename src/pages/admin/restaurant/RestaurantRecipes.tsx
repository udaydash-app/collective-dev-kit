import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Trash2, Plus, Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';

const sb: any = supabase;

export default function RestaurantRecipes() {
  const [items, setItems] = useState<any[]>([]);
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [recipes, setRecipes] = useState<any[]>([]);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [add, setAdd] = useState({ ingredient_id: '', quantity: '1' });
  const [generating, setGenerating] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => { reload(); }, []);
  async function reload() {
    const [i, ing, r] = await Promise.all([
      sb.from('restaurant_menu_items').select('id,name,description,price').order('name'),
      sb.from('restaurant_ingredients').select('*').eq('is_active', true).order('name'),
      sb.from('restaurant_recipes').select('*'),
    ]);
    setItems(i.data || []);
    setIngredients(ing.data || []);
    setRecipes(r.data || []);
    if (!selectedItem && i.data?.length) setSelectedItem(i.data[0].id);
  }

  async function addRecipe() {
    if (!selectedItem || !add.ingredient_id) return;
    const { error } = await sb.from('restaurant_recipes').insert({
      menu_item_id: selectedItem, ingredient_id: add.ingredient_id,
      quantity: Number(add.quantity) || 1,
      unit: ingredients.find(x => x.id === add.ingredient_id)?.unit || 'unit',
    });
    if (error) return toast.error(error.message);
    setAdd({ ingredient_id: '', quantity: '1' });
    reload();
  }

  async function del(id: string) {
    await sb.from('restaurant_recipes').delete().eq('id', id);
    reload();
  }

  async function generateAI() {
    const item = items.find(x => x.id === selectedItem);
    if (!item) return;
    if (!ingredients.length) return toast.error('Add ingredients first (Ingredients tab).');
    setGenerating(true);
    try {
      const { data, error } = await sb.functions.invoke('generate-recipe', {
        body: { menu_item_name: item.name, description: item.description, ingredients: ingredients.map(i => ({ name: i.name, unit: i.unit })) },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const suggestions = data?.items || [];
      if (!suggestions.length) return toast.error('AI returned no ingredients.');

      // Delete existing recipe lines for clean replace
      await sb.from('restaurant_recipes').delete().eq('menu_item_id', selectedItem);
      const rows = suggestions.map((s: any) => {
        const ing = ingredients.find(i => i.name.toLowerCase() === String(s.ingredient_name).toLowerCase());
        if (!ing) return null;
        return { menu_item_id: selectedItem, ingredient_id: ing.id, quantity: Number(s.quantity) || 0, unit: ing.unit };
      }).filter(Boolean);
      if (!rows.length) return toast.error('AI suggestions did not match any ingredient.');
      const { error: e2 } = await sb.from('restaurant_recipes').insert(rows);
      if (e2) throw e2;
      toast.success(`Generated ${rows.length} ingredients with AI.`);
      reload();
    } catch (e: any) {
      toast.error(e.message || 'AI generation failed');
    } finally {
      setGenerating(false);
    }
  }

  const itemRecipes = recipes.filter(r => r.menu_item_id === selectedItem);
  const currentItem = items.find(i => i.id === selectedItem);
  const totalCost = itemRecipes.reduce((s, r) => {
    const ing = ingredients.find(i => i.id === r.ingredient_id);
    return s + (Number(r.quantity) || 0) * (Number(ing?.avg_cost) || 0);
  }, 0);
  const price = Number(currentItem?.price) || 0;
  const margin = price > 0 ? ((price - totalCost) / price) * 100 : 0;

  const filteredItems = items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-4 grid grid-cols-12 gap-4 h-screen">
      <Card className="col-span-4 p-3 overflow-auto flex flex-col">
        <h2 className="font-semibold mb-2">Menu Items</h2>
        <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="mb-2" />
        <div className="space-y-1 overflow-auto flex-1">
          {filteredItems.map(i => {
            const count = recipes.filter(r => r.menu_item_id === i.id).length;
            return (
              <button key={i.id} onClick={() => setSelectedItem(i.id)}
                className={`w-full text-left p-2 rounded ${selectedItem === i.id ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}>
                <div className="flex justify-between items-center">
                  <span>{i.name}</span>
                  <span className="text-xs opacity-70">{count} ing.</span>
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      <Card className="col-span-8 p-3 overflow-auto flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-semibold">{currentItem?.name || 'Select an item'}</h2>
            {currentItem && (
              <div className="text-sm text-muted-foreground">
                Price: {formatCurrency(price)} · Cost: <span className="font-semibold text-foreground">{formatCurrency(totalCost)}</span> · Margin: <span className={margin >= 0 ? 'text-emerald-600' : 'text-destructive'}>{margin.toFixed(1)}%</span>
              </div>
            )}
          </div>
          <Button onClick={generateAI} disabled={!selectedItem || generating} variant="secondary">
            {generating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
            AI Generate Recipe
          </Button>
        </div>

        <div className="flex gap-2 mb-3">
          <select value={add.ingredient_id} onChange={e => setAdd({ ...add, ingredient_id: e.target.value })} className="flex-1 border rounded px-2 h-9 bg-background">
            <option value="">Select ingredient...</option>
            {ingredients.map(p => <option key={p.id} value={p.id}>{p.name} ({p.unit}) — {formatCurrency(p.avg_cost)}/{p.unit}</option>)}
          </select>
          <Input type="number" value={add.quantity} onChange={e => setAdd({ ...add, quantity: e.target.value })} className="w-24" placeholder="Qty" />
          <Button onClick={addRecipe} disabled={!selectedItem}><Plus className="h-4 w-4" /></Button>
        </div>

        <div className="space-y-1 overflow-auto flex-1">
          {itemRecipes.map(r => {
            const ing = ingredients.find(i => i.id === r.ingredient_id);
            const lineCost = (Number(r.quantity) || 0) * (Number(ing?.avg_cost) || 0);
            return (
              <div key={r.id} className="flex items-center gap-2 border rounded p-2">
                <div className="flex-1">{ing?.name || '(missing ingredient)'}</div>
                <div className="text-sm text-muted-foreground">{r.quantity} {ing?.unit || r.unit}</div>
                <div className="text-sm font-semibold w-24 text-right">{formatCurrency(lineCost)}</div>
                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => del(r.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            );
          })}
          {!itemRecipes.length && <p className="text-sm text-muted-foreground text-center py-8">No ingredients linked. Add manually or use AI Generate. Stock won't deduct on sale until you link ingredients.</p>}
        </div>
      </Card>
    </div>
  );
}