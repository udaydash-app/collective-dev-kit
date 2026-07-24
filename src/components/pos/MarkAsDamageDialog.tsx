import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { CartItem } from '@/hooks/usePOSTransaction';
import { AlertTriangle, Loader2 } from 'lucide-react';

interface MarkAsDamageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: CartItem[];
  storeId: string;
  onSuccess: () => void;
}

type CostMap = Record<string, number>;

export const MarkAsDamageDialog = ({
  open,
  onOpenChange,
  items,
  storeId,
  onSuccess,
}: MarkAsDamageDialogProps) => {
  const [reason, setReason] = useState('damage');
  const [saving, setSaving] = useState(false);
  const [costs, setCosts] = useState<CostMap>({});

  const damageableItems = items.filter(i => i.id !== 'cart-discount' && !i.isCombo && !i.isOneTimeOffer);

  // Fetch fresh cost prices for accurate journal value
  useEffect(() => {
    if (!open || damageableItems.length === 0) return;
    let cancelled = false;
    (async () => {
      const productIds = damageableItems
        .filter(i => i.id === i.productId)
        .map(i => i.productId);
      const variantIds = damageableItems
        .filter(i => i.id !== i.productId)
        .map(i => i.id);

      const next: CostMap = {};
      if (productIds.length) {
        const { data } = await supabase.from('products').select('id, cost_price, local_charges').in('id', productIds);
        (data ?? []).forEach((p: any) => {
          next[p.id] = Number(p.cost_price ?? 0) + Number(p.local_charges ?? 0);
        });
      }
      if (variantIds.length) {
        const { data } = await supabase.from('product_variants').select('id, cost_price').in('id', variantIds);
        (data ?? []).forEach((v: any) => {
          next[v.id] = Number(v.cost_price ?? 0);
        });
      }
      if (!cancelled) setCosts(next);
    })();
    return () => { cancelled = true; };
  }, [open, damageableItems.map(i => i.id).join(',')]);

  useEffect(() => {
    if (open) setReason('damage');
  }, [open]);

  const unitCostFor = (item: CartItem) => costs[item.id] ?? 0;
  const totalValue = damageableItems.reduce((s, i) => s + unitCostFor(i) * i.quantity, 0);

  const handleConfirm = async () => {
    if (!storeId) { toast.error('No store selected'); return; }
    if (damageableItems.length === 0) { toast.error('Nothing to mark as damage'); return; }
    const trimmedReason = reason.trim() || 'damage';
    setSaving(true);
    try {
      // Resolve adjusted_by (auth user if available, else PIN session pos_user)
      let adjustedBy: string | null = null;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        adjustedBy = user?.id ?? null;
      } catch { /* offline */ }
      if (!adjustedBy) {
        const raw = localStorage.getItem('offline_pos_session');
        if (raw) {
          try { adjustedBy = JSON.parse(raw)?.pos_user_id ?? null; } catch { /* ignore */ }
        }
      }

      const rows = damageableItems.map(item => {
        const isVariant = item.id !== item.productId;
        const unitCost = unitCostFor(item);
        const qty = -Math.abs(item.quantity);
        return {
          product_id: item.productId,
          variant_id: isVariant ? item.id : null,
          store_id: storeId,
          adjustment_type: 'damage',
          quantity_change: qty,
          unit_cost: unitCost,
          total_value: unitCost * qty,
          cost_source: unitCost > 0 ? 'product' : 'system',
          reason: trimmedReason,
          adjusted_by: adjustedBy,
        };
      });

      const { error } = await supabase.from('stock_adjustments').insert(rows);
      if (error) throw error;
      toast.success(`Marked ${rows.length} item(s) as damage`);
      onOpenChange(false);
      onSuccess();
    } catch (e: any) {
      console.error('Mark as damage failed:', e);
      toast.error('Failed to mark as damage: ' + (e?.message ?? 'unknown error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" /> Mark cart as Damage
          </DialogTitle>
          <DialogDescription>
            Deducts these items from stock and posts <b>Dr 6585 Damage / Cr 311 Inventory</b> at cost. No sale, no payment, no A/R.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="max-h-[45vh] overflow-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit cost</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {damageableItems.map(item => {
                  const uc = unitCostFor(item);
                  return (
                    <TableRow key={item.id}>
                      <TableCell>{item.displayName || item.name}</TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">{formatCurrency(uc)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(uc * item.quantity)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Total inventory write-off</span>
            <span className="font-semibold">{formatCurrency(totalValue)}</span>
          </div>

          <div className="space-y-2">
            <Label htmlFor="damage-reason">Reason</Label>
            <Input
              id="damage-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. damage, expired, broken in transit"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={saving || damageableItems.length === 0}>
            {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving…</> : 'Confirm write-off'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MarkAsDamageDialog;