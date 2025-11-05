import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { ReturnToPOSButton } from '@/components/layout/ReturnToPOSButton';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function StockReconciliation() {
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');

  const { data: stores } = useQuery({
    queryKey: ['stores'],
    queryFn: async () => {
      const { data } = await supabase
        .from('stores')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      return data || [];
    },
  });

  const { data: mismatches, isLoading, refetch } = useQuery({
    queryKey: ['stock-mismatches', selectedStoreId],
    queryFn: async () => {
      if (!selectedStoreId) return [];

      const { data: products } = await supabase
        .from('products')
        .select(`
          id,
          name,
          stock_quantity,
          store_id,
          product_variants(id, label, stock_quantity)
        `)
        .eq('store_id', selectedStoreId);

      const results: any[] = [];

      for (const product of products || []) {
        if (!product.product_variants || product.product_variants.length === 0) {
          // Check product-level layers
          const { data: layers } = await supabase
            .from('inventory_layers')
            .select('quantity_remaining')
            .eq('product_id', product.id)
            .is('variant_id', null);

          const layerStock = layers?.reduce((sum, l) => sum + Number(l.quantity_remaining), 0) || 0;
          const systemStock = product.stock_quantity || 0;

          if (layerStock !== systemStock) {
            results.push({
              product_id: product.id,
              variant_id: null,
              product_name: product.name,
              variant_label: null,
              system_stock: systemStock,
              layer_stock: layerStock,
              difference: systemStock - layerStock,
            });
          }
        } else {
          // Check variant-level layers
          for (const variant of product.product_variants) {
            const { data: layers } = await supabase
              .from('inventory_layers')
              .select('quantity_remaining')
              .eq('product_id', product.id)
              .eq('variant_id', variant.id);

            const layerStock = layers?.reduce((sum, l) => sum + Number(l.quantity_remaining), 0) || 0;
            const systemStock = variant.stock_quantity || 0;

            if (layerStock !== systemStock) {
              results.push({
                product_id: product.id,
                variant_id: variant.id,
                product_name: product.name,
                variant_label: variant.label,
                system_stock: systemStock,
                layer_stock: layerStock,
                difference: systemStock - layerStock,
              });
            }
          }
        }
      }

      return results;
    },
    enabled: !!selectedStoreId,
  });

  const handleAutoFix = async (item: any) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Update system stock to match layer stock
      if (item.variant_id) {
        await supabase
          .from('product_variants')
          .update({ stock_quantity: item.layer_stock })
          .eq('id', item.variant_id);
      } else {
        await supabase
          .from('products')
          .update({ stock_quantity: item.layer_stock })
          .eq('id', item.product_id);
      }

      // Log the adjustment
      await supabase
        .from('stock_adjustments')
        .insert({
          product_id: item.product_id,
          variant_id: item.variant_id,
          adjustment_type: 'reconciliation',
          adjustment_quantity: -item.difference,
          quantity_change: -item.difference,
          reason: 'Auto-reconciliation - system adjusted to match FIFO layers',
          adjusted_by: user?.id,
          store_id: selectedStoreId,
        });

      toast.success('Stock reconciled successfully');
      refetch();
    } catch (error: any) {
      toast.error('Failed to reconcile: ' + error.message);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Stock Reconciliation</h1>
          <p className="text-muted-foreground">Identify and fix mismatches between system stock and FIFO layers</p>
        </div>
        <ReturnToPOSButton />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select store" />
                </SelectTrigger>
                <SelectContent>
                  {stores?.map((store) => (
                    <SelectItem key={store.id} value={store.id}>
                      {store.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedStoreId && (
              <Button onClick={() => refetch()} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {!selectedStoreId ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Please select a store to check for stock mismatches</AlertDescription>
        </Alert>
      ) : isLoading ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">Analyzing stock and inventory layers...</p>
          </CardContent>
        </Card>
      ) : mismatches && mismatches.length === 0 ? (
        <Alert>
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription>No mismatches found! All stock quantities match FIFO layers.</AlertDescription>
        </Alert>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Stock Mismatches ({mismatches?.length || 0})</CardTitle>
            <CardDescription>
              Products where system stock doesn't match inventory layer totals
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Variant</TableHead>
                  <TableHead className="text-right">System Stock</TableHead>
                  <TableHead className="text-right">Layer Stock</TableHead>
                  <TableHead className="text-right">Difference</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mismatches?.map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{item.product_name}</TableCell>
                    <TableCell>{item.variant_label || '-'}</TableCell>
                    <TableCell className="text-right">{item.system_stock}</TableCell>
                    <TableCell className="text-right">{item.layer_stock}</TableCell>
                    <TableCell className={`text-right font-semibold ${
                      item.difference > 0 ? 'text-red-600' : 'text-yellow-600'
                    }`}>
                      {item.difference > 0 ? `+${item.difference}` : item.difference}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAutoFix(item)}
                      >
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Fix
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
