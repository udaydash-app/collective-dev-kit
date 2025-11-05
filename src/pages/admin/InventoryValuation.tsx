import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Package, TrendingUp, DollarSign } from 'lucide-react';
import { ReturnToPOSButton } from '@/components/layout/ReturnToPOSButton';
import { formatCurrency } from '@/lib/utils';

export default function InventoryValuation() {
  const [selectedStoreId, setSelectedStoreId] = useState<string>('all');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');

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

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data } = await supabase
        .from('categories')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      return data || [];
    },
  });

  const { data: valuationData, isLoading } = useQuery({
    queryKey: ['inventory-valuation', selectedStoreId, selectedCategoryId],
    queryFn: async () => {
      let query = supabase
        .from('products')
        .select(`
          id,
          name,
          stock_quantity,
          cost_price,
          store_id,
          category_id,
          categories(name),
          product_variants(
            id,
            label,
            stock_quantity
          )
        `);

      if (selectedStoreId !== 'all') {
        query = query.eq('store_id', selectedStoreId);
      }

      if (selectedCategoryId !== 'all') {
        query = query.eq('category_id', selectedCategoryId);
      }

      const { data: products } = await query;

      const valuations: any[] = [];

      for (const product of products || []) {
        if (!product.product_variants || product.product_variants.length === 0) {
          // Product-level valuation
          const { data: layers } = await supabase
            .from('inventory_layers')
            .select('quantity_remaining, unit_cost')
            .eq('product_id', product.id)
            .is('variant_id', null)
            .gt('quantity_remaining', 0);

          const fifoValue = layers?.reduce(
            (sum, l) => sum + Number(l.quantity_remaining) * Number(l.unit_cost),
            0
          ) || 0;

          const fifoQty = layers?.reduce((sum, l) => sum + Number(l.quantity_remaining), 0) || 0;
          
          const weightedAvgCost = layers && layers.length > 0
            ? layers.reduce((sum, l) => sum + Number(l.quantity_remaining) * Number(l.unit_cost), 0) /
              layers.reduce((sum, l) => sum + Number(l.quantity_remaining), 0)
            : product.cost_price || 0;

          const avgValue = fifoQty * weightedAvgCost;

          valuations.push({
            product_id: product.id,
            product_name: product.name,
            variant_label: null,
            category: product.categories?.name || 'Uncategorized',
            stock_quantity: fifoQty,
            system_quantity: product.stock_quantity || 0,
            fifo_value: fifoValue,
            avg_value: avgValue,
            difference: fifoValue - avgValue,
            fifo_unit_cost: fifoQty > 0 ? fifoValue / fifoQty : 0,
            avg_unit_cost: weightedAvgCost,
          });
        } else {
          // Variant-level valuation
          for (const variant of product.product_variants) {
            const { data: layers } = await supabase
              .from('inventory_layers')
              .select('quantity_remaining, unit_cost')
              .eq('product_id', product.id)
              .eq('variant_id', variant.id)
              .gt('quantity_remaining', 0);

            const fifoValue = layers?.reduce(
              (sum, l) => sum + Number(l.quantity_remaining) * Number(l.unit_cost),
              0
            ) || 0;

            const fifoQty = layers?.reduce((sum, l) => sum + Number(l.quantity_remaining), 0) || 0;

            const weightedAvgCost = layers && layers.length > 0
              ? layers.reduce((sum, l) => sum + Number(l.quantity_remaining) * Number(l.unit_cost), 0) /
                layers.reduce((sum, l) => sum + Number(l.quantity_remaining), 0)
              : product.cost_price || 0;

            const avgValue = fifoQty * weightedAvgCost;

            valuations.push({
              product_id: product.id,
              product_name: product.name,
              variant_label: variant.label,
              category: product.categories?.name || 'Uncategorized',
              stock_quantity: fifoQty,
              system_quantity: variant.stock_quantity || 0,
              fifo_value: fifoValue,
              avg_value: avgValue,
              difference: fifoValue - avgValue,
              fifo_unit_cost: fifoQty > 0 ? fifoValue / fifoQty : 0,
              avg_unit_cost: weightedAvgCost,
            });
          }
        }
      }

      const totals = valuations.reduce(
        (acc, item) => ({
          fifo_value: acc.fifo_value + item.fifo_value,
          avg_value: acc.avg_value + item.avg_value,
          difference: acc.difference + item.difference,
        }),
        { fifo_value: 0, avg_value: 0, difference: 0 }
      );

      return { valuations, totals };
    },
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Inventory Valuation</h1>
          <p className="text-muted-foreground">Compare FIFO cost method with weighted average cost</p>
        </div>
        <ReturnToPOSButton />
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              FIFO Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(valuationData?.totals.fifo_value || 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">First In, First Out method</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              Weighted Avg Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(valuationData?.totals.avg_value || 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">Weighted average cost method</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              Difference
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${
              (valuationData?.totals.difference || 0) >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {formatCurrency(valuationData?.totals.difference || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">FIFO vs Weighted Avg</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
              <SelectTrigger>
                <SelectValue placeholder="All Stores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stores</SelectItem>
                {stores?.map((store) => (
                  <SelectItem key={store.id} value={store.id}>
                    {store.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories?.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Results Table */}
      <Card>
        <CardHeader>
          <CardTitle>Valuation Details ({valuationData?.valuations.length || 0} items)</CardTitle>
          <CardDescription>Product-by-product inventory valuation comparison</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">Loading valuation data...</p>
          ) : !valuationData || valuationData.valuations.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No inventory found</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Variant</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">FIFO Unit Cost</TableHead>
                    <TableHead className="text-right">FIFO Total</TableHead>
                    <TableHead className="text-right">Avg Unit Cost</TableHead>
                    <TableHead className="text-right">Avg Total</TableHead>
                    <TableHead className="text-right">Difference</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {valuationData.valuations.map((item: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{item.product_name}</TableCell>
                      <TableCell>{item.variant_label || '-'}</TableCell>
                      <TableCell>{item.category}</TableCell>
                      <TableCell className="text-right">{item.stock_quantity}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.fifo_unit_cost)}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(item.fifo_value)}
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(item.avg_unit_cost)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.avg_value)}</TableCell>
                      <TableCell className={`text-right font-semibold ${
                        item.difference >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {formatCurrency(item.difference)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
