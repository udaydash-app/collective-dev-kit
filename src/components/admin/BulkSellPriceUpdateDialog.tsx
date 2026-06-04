import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCurrency, getEffectiveCost, getVariantEffectiveCost } from '@/lib/utils';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

type Row = {
  key: string;
  productId: string;
  variantId?: string;
  name: string;
  effectiveCost: number;
  currentPrice: number;
  isVariant: boolean;
};

export function BulkSellPriceUpdateDialog({ open, onOpenChange }: Props) {
  const [storeId, setStoreId] = useState<string>('all');
  const [categoryId, setCategoryId] = useState<string>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [priceDialogOpen, setPriceDialogOpen] = useState(false);
  const [newPrice, setNewPrice] = useState<string>('');
  const queryClient = useQueryClient();

  const { data: stores } = useQuery({
    queryKey: ['bulk-sell-stores'],
    queryFn: async () => {
      const { data, error } = await supabase.from('stores').select('id, name').eq('is_active', true).order('name');
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  const { data: categories } = useQuery({
    queryKey: ['bulk-sell-categories'],
    queryFn: async () => {
      const { data, error } = await supabase.from('categories').select('id, name').eq('is_active', true).order('name');
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  const canLoad = storeId !== '' && categoryId !== '';

  const { data: products, isLoading } = useQuery({
    queryKey: ['bulk-sell-products', storeId, categoryId],
    queryFn: async () => {
      let q = supabase
        .from('products')
        .select('id, name, price, cost_price, local_charges, store_id, category_id, product_variants(*)')
        .eq('is_available', true)
        .order('name');
      if (storeId !== 'all') q = q.eq('store_id', storeId);
      if (categoryId !== 'all') q = q.eq('category_id', categoryId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    enabled: open && canLoad,
  });

  const rows = useMemo<Row[]>(() => {
    if (!products) return [];
    const out: Row[] = [];
    for (const p of products as any[]) {
      const variants = p.product_variants ?? [];
      if (variants.length > 0) {
        for (const v of variants) {
          out.push({
            key: `v:${v.id}`,
            productId: p.id,
            variantId: v.id,
            name: `${p.name} (${v.label ?? ''})`,
            effectiveCost: getVariantEffectiveCost(v, p),
            currentPrice: Number(v.price) || 0,
            isVariant: true,
          });
        }
      } else {
        out.push({
          key: `p:${p.id}`,
          productId: p.id,
          name: p.name,
          effectiveCost: getEffectiveCost(p),
          currentPrice: Number(p.price) || 0,
          isVariant: false,
        });
      }
    }
    return out;
  }, [products]);

  const toggle = (key: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key); else n.add(key);
      return n;
    });
  };

  const toggleAll = () => {
    if (selected.size === rows.length) setSelected(new Set());
    else setSelected(new Set(rows.map((r) => r.key)));
  };

  const updateMutation = useMutation({
    mutationFn: async (price: number) => {
      const items = rows.filter((r) => selected.has(r.key));
      const variantIds = items.filter((r) => r.isVariant).map((r) => r.variantId!);
      const productIds = items.filter((r) => !r.isVariant).map((r) => r.productId);
      if (variantIds.length > 0) {
        const { error } = await supabase.from('product_variants').update({ price }).in('id', variantIds);
        if (error) throw error;
      }
      if (productIds.length > 0) {
        const { error } = await supabase.from('products').update({ price }).in('id', productIds);
        if (error) throw error;
      }
      return items.length;
    },
    onSuccess: (count) => {
      toast.success(`Updated sale price for ${count} item(s)`);
      queryClient.invalidateQueries({ queryKey: ['products-stock-price'] });
      queryClient.invalidateQueries({ queryKey: ['bulk-sell-products'] });
      setPriceDialogOpen(false);
      setNewPrice('');
      setSelected(new Set());
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(`Failed to update: ${e.message}`),
  });

  const handleConfirm = () => {
    const p = parseFloat(newPrice);
    if (isNaN(p) || p < 0) {
      toast.error('Enter a valid price');
      return;
    }
    updateMutation.mutate(p);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Bulk Sell Price Update</DialogTitle>
            <DialogDescription>
              Select a store and category, then choose products and set a single sale price.
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-4">
            <div className="flex-1">
              <Label>Store</Label>
              <Select value={storeId} onValueChange={(v) => { setStoreId(v); setSelected(new Set()); }}>
                <SelectTrigger><SelectValue placeholder="Select store" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stores</SelectItem>
                  {stores?.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label>Category</Label>
              <Select value={categoryId} onValueChange={(v) => { setCategoryId(v); setSelected(new Set()); }}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories?.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex-1 overflow-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={rows.length > 0 && selected.size === rows.length}
                      onCheckedChange={toggleAll}
                    />
                  </TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Effective Cost</TableHead>
                  <TableHead className="text-right">Current Sale Price</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-6">Loading...</TableCell></TableRow>
                ) : rows.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">No products found</TableCell></TableRow>
                ) : rows.map((r) => (
                  <TableRow key={r.key} className="cursor-pointer" onClick={() => toggle(r.key)}>
                    <TableCell><Checkbox checked={selected.has(r.key)} onCheckedChange={() => toggle(r.key)} /></TableCell>
                    <TableCell>{r.name}</TableCell>
                    <TableCell className="text-right">{formatCurrency(r.effectiveCost)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(r.currentPrice)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <DialogFooter>
            <div className="text-sm text-muted-foreground mr-auto">{selected.size} selected</div>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button disabled={selected.size === 0} onClick={() => setPriceDialogOpen(true)}>Update</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={priceDialogOpen} onOpenChange={setPriceDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Set Sale Price</DialogTitle>
            <DialogDescription>
              This price will be applied to {selected.size} selected item(s).
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label>Sale Price</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPriceDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleConfirm} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Updating...' : 'Apply'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}