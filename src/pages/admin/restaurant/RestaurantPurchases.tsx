import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { MinimizableDialog } from '@/components/ui/minimizable-dialog';
import { RestaurantNavButtons } from '@/components/layout/RestaurantNavButtons';
import { Plus, Trash2, Receipt, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency, formatDate } from '@/lib/utils';

const sb: any = supabase;

type Line = { ingredient_id: string; quantity: string; unit_cost: string };

// Convert ingredient base unit (g/ml/pcs) to a friendlier purchase unit (kg/L/pcs).
function purchaseUnitFor(baseUnit?: string) {
  if (baseUnit === 'g') return { label: 'kg', factor: 1000 };
  if (baseUnit === 'ml') return { label: 'L', factor: 1000 };
  return { label: baseUnit || 'pcs', factor: 1 };
}

export default function RestaurantPurchases() {
  const [purchases, setPurchases] = useState<any[]>([]);
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [supplier, setSupplier] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<Line[]>([{ ingredient_id: '', quantity: '', unit_cost: '' }]);
  const [viewing, setViewing] = useState<any | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => { reload(); }, []);
  async function reload() {
    const [p, ing] = await Promise.all([
      sb.from('restaurant_purchases').select('*, restaurant_purchase_items(*, restaurant_ingredients(name,unit))').order('purchase_date', { ascending: false }).limit(200),
      sb.from('restaurant_ingredients').select('id,name,unit,last_cost').eq('is_active', true).order('name'),
    ]);
    setPurchases(p.data || []);
    setIngredients(ing.data || []);
  }

  function addLine() { setLines([...lines, { ingredient_id: '', quantity: '', unit_cost: '' }]); }
  function removeLine(idx: number) { setLines(lines.filter((_, i) => i !== idx)); }
  function updateLine(idx: number, patch: Partial<Line>) {
    setLines(lines.map((l, i) => i === idx ? { ...l, ...patch } : l));
  }

  const total = lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unit_cost) || 0), 0);

  function resetForm() {
    setEditingId(null); setSupplier(''); setNotes('');
    setLines([{ ingredient_id: '', quantity: '', unit_cost: '' }]);
  }

  function startEdit(p: any) {
    setEditingId(p.id);
    setSupplier(p.supplier_name || '');
    setNotes(p.notes || '');
    setLines((p.restaurant_purchase_items || []).map((it: any) => {
      const f = purchaseUnitFor(it.restaurant_ingredients?.unit).factor;
      return {
        ingredient_id: it.ingredient_id,
        quantity: String(Number(it.quantity) / f),
        unit_cost: String(Number(it.unit_cost) * f),
      };
    }));
    setViewing(null);
    setOpen(true);
  }

  async function save() {
    const valid = lines.filter(l => l.ingredient_id && Number(l.quantity) > 0 && Number(l.unit_cost) >= 0);
    if (!valid.length) return toast.error('Add at least one valid line.');
    let purchaseId = editingId;
    if (editingId) {
      const { error: eu } = await sb.from('restaurant_purchases').update({
        supplier_name: supplier || null, notes: notes || null,
      }).eq('id', editingId);
      if (eu) return toast.error(eu.message);
      // reverse existing lines via delete (triggers reverse stock)
      const { error: ed } = await sb.from('restaurant_purchase_items').delete().eq('purchase_id', editingId);
      if (ed) return toast.error(ed.message);
    } else {
      const { data: ph, error } = await sb.from('restaurant_purchases').insert({
        supplier_name: supplier || null, notes: notes || null,
      }).select().single();
      if (error) return toast.error(error.message);
      purchaseId = ph.id;
    }
    const rows = valid.map(l => {
      const ing = ingredients.find(x => x.id === l.ingredient_id);
      const f = purchaseUnitFor(ing?.unit).factor;
      return {
        purchase_id: purchaseId,
        ingredient_id: l.ingredient_id,
        quantity: Number(l.quantity) * f,        // store in base unit (g/ml/pcs)
        unit_cost: Number(l.unit_cost) / f,      // store per base unit
      };
    });
    const { error: e2 } = await sb.from('restaurant_purchase_items').insert(rows);
    if (e2) return toast.error(e2.message);
    toast.success(editingId ? 'Purchase updated — stock adjusted.' : 'Purchase recorded — stock updated.');
    setOpen(false); resetForm();
    reload();
  }

  async function del(id: string) {
    if (!confirm('Delete purchase? Stock added by it will be reversed.')) return;
    const { error } = await sb.from('restaurant_purchases').delete().eq('id', id);
    if (error) return toast.error(error.message);
    reload();
  }

  return (
    <div className="p-4 space-y-4 min-h-full">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Ingredient Purchases</h1>
        <div className="flex items-center gap-2">
          <RestaurantNavButtons />
          <Button onClick={() => { resetForm(); setOpen(true); }}><Plus className="h-4 w-4 mr-1" /> New Purchase</Button>
        </div>
      </div>

      <Card className="p-0 overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-2">Date</th>
              <th className="text-left p-2">Purchase #</th>
              <th className="text-left p-2">Supplier</th>
              <th className="text-right p-2">Items</th>
              <th className="text-right p-2">Total</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {purchases.map(p => (
              <tr key={p.id} className="border-t hover:bg-accent/30 cursor-pointer" onClick={() => setViewing(p)}>
                <td className="p-2">{formatDate(p.purchase_date)}</td>
                <td className="p-2 font-mono text-xs">{p.purchase_no}</td>
                <td className="p-2">{p.supplier_name || '—'}</td>
                <td className="p-2 text-right">{p.restaurant_purchase_items?.length || 0}</td>
                <td className="p-2 text-right font-semibold">{formatCurrency(p.total)}</td>
                <td className="p-2 text-right whitespace-nowrap">
                  <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); startEdit(p); }}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={(e) => { e.stopPropagation(); del(p.id); }}><Trash2 className="h-4 w-4" /></Button>
                </td>
              </tr>
            ))}
            {!purchases.length && <tr><td colSpan={6} className="text-center p-8 text-muted-foreground">No purchases yet.</td></tr>}
          </tbody>
        </table>
      </Card>

      <MinimizableDialog
        open={open}
        onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}
        title={editingId ? 'Edit Purchase' : 'New Ingredient Purchase'}
        icon={Receipt}
        className="max-w-3xl"
      >
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Supplier name (optional)" value={supplier} onChange={e => setSupplier(e.target.value)} />
              <Input placeholder="Notes (optional)" value={notes} onChange={e => setNotes(e.target.value)} />
            </div>
            <div className="space-y-2 max-h-96 overflow-auto">
              {lines.map((l, i) => {
                const ing = ingredients.find(x => x.id === l.ingredient_id);
                const pu = purchaseUnitFor(ing?.unit);
                return (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center">
                    <select className="col-span-5 border rounded h-10 px-2 bg-background" value={l.ingredient_id} onChange={e => {
                      const sel = ingredients.find(x => x.id === e.target.value);
                      const selPu = purchaseUnitFor(sel?.unit);
                      updateLine(i, {
                        ingredient_id: e.target.value,
                        unit_cost: l.unit_cost || (sel?.last_cost ? String(Number(sel.last_cost) * selPu.factor) : ''),
                      });
                    }}>
                      <option value="">Select ingredient...</option>
                      {ingredients.map(ing => {
                        const u = purchaseUnitFor(ing.unit).label;
                        return <option key={ing.id} value={ing.id}>{ing.name} ({u})</option>;
                      })}
                    </select>
                    <Input className="col-span-2" type="number" step="any" placeholder={`Qty (${pu.label})`} value={l.quantity} onChange={e => updateLine(i, { quantity: e.target.value })} />
                    <div className="col-span-1 text-xs text-muted-foreground">{pu.label}</div>
                    <Input className="col-span-3" type="number" step="any" placeholder={`Price / ${pu.label}`} value={l.unit_cost} onChange={e => updateLine(i, { unit_cost: e.target.value })} />
                    <Button variant="ghost" size="icon" className="col-span-1 text-destructive" onClick={() => removeLine(i)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                );
              })}
              <Button variant="outline" size="sm" onClick={addLine}><Plus className="h-4 w-4 mr-1" /> Add line</Button>
            </div>
            <div className="text-right text-lg font-bold">Total: {formatCurrency(total)}</div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>{editingId ? 'Update Purchase' : 'Save Purchase'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* placeholder */}

      <Dialog open={!!viewing} onOpenChange={() => setViewing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" /> {viewing?.purchase_no}
            </DialogTitle>
          </DialogHeader>
          {viewing && (
            <div className="space-y-2 text-sm">
              <div>Date: {formatDate(viewing.purchase_date)}</div>
              <div>Supplier: {viewing.supplier_name || '—'}</div>
              {viewing.notes && <div>Notes: {viewing.notes}</div>}
              <table className="w-full mt-2">
                <thead><tr className="text-left border-b"><th>Ingredient</th><th className="text-right">Qty</th><th className="text-right">Unit cost</th><th className="text-right">Total</th></tr></thead>
                <tbody>
                  {viewing.restaurant_purchase_items?.map((it: any) => {
                    const pu = purchaseUnitFor(it.restaurant_ingredients?.unit);
                    const qty = Number(it.quantity) / pu.factor;
                    const price = Number(it.unit_cost) * pu.factor;
                    return (
                      <tr key={it.id} className="border-b">
                        <td>{it.restaurant_ingredients?.name}</td>
                        <td className="text-right">{qty.toFixed(qty < 1 ? 3 : 2)} {pu.label}</td>
                        <td className="text-right">{formatCurrency(price)} / {pu.label}</td>
                        <td className="text-right">{formatCurrency(it.total)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="text-right text-lg font-bold pt-2">Total: {formatCurrency(viewing.total)}</div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => startEdit(viewing)}>
                  <Pencil className="h-4 w-4 mr-1" /> Edit
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}