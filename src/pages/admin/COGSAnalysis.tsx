import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TrendingUp, DollarSign, Package } from 'lucide-react';
import { ReturnToPOSButton } from '@/components/layout/ReturnToPOSButton';
import { formatCurrency } from '@/lib/utils';

export default function COGSAnalysis() {
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

  const { data: cogsData, isLoading } = useQuery({
    queryKey: ['cogs-analysis', selectedStoreId, selectedCategoryId],
    queryFn: async () => {
      // Fetch products with cost_price
      let productsQuery = supabase
        .from('products')
        .select(`
          id,
          name,
          cost_price,
          price,
          store_id,
          category_id,
          categories(name)
        `);

      if (selectedStoreId !== 'all') {
        productsQuery = productsQuery.eq('store_id', selectedStoreId);
      }

      if (selectedCategoryId !== 'all') {
        productsQuery = productsQuery.eq('category_id', selectedCategoryId);
      }

      const { data: products } = await productsQuery;
      const productMap = new Map(products?.map(p => [p.id, p]) || []);

      // Fetch POS transactions
      let txQuery = supabase
        .from('pos_transactions')
        .select('id, items, store_id');

      if (selectedStoreId !== 'all') {
        txQuery = txQuery.eq('store_id', selectedStoreId);
      }

      const { data: transactions } = await txQuery;

      // Calculate COGS from transactions using simple cost_price
      const productStats: Record<string, any> = {};

      transactions?.forEach((tx: any) => {
        const items = tx.items as any[];
        items?.forEach((item: any) => {
          const productId = item.productId;
          const product = productMap.get(productId);
          if (!product) return;

          // Skip if filtering by category and product doesn't match
          if (selectedCategoryId !== 'all' && product.category_id !== selectedCategoryId) return;

          const quantity = Math.abs(item.quantity || 0);
          const revenue = (item.price || 0) * quantity;
          const cogs = (product.cost_price || 0) * quantity;

          if (!productStats[productId]) {
            productStats[productId] = {
              product_id: productId,
              product_name: product.name,
              category: product.categories?.name || 'Uncategorized',
              quantity_sold: 0,
              revenue: 0,
              cogs: 0,
              gross_profit: 0,
              margin_percent: 0,
            };
          }

          productStats[productId].quantity_sold += quantity;
          productStats[productId].revenue += revenue;
          productStats[productId].cogs += cogs;
        });
      });

      // Calculate gross profit and margin
      const results = Object.values(productStats).map((stat: any) => {
        stat.gross_profit = stat.revenue - stat.cogs;
        stat.margin_percent = stat.revenue > 0 ? (stat.gross_profit / stat.revenue) * 100 : 0;
        return stat;
      });

      // Sort by revenue descending
      results.sort((a, b) => b.revenue - a.revenue);

      // Calculate totals
      const totals = results.reduce(
        (acc, item) => ({
          revenue: acc.revenue + item.revenue,
          cogs: acc.cogs + item.cogs,
          gross_profit: acc.gross_profit + item.gross_profit,
        }),
        { revenue: 0, cogs: 0, gross_profit: 0 }
      );

      return { products: results, totals };
    },
  });

  const overallMargin = cogsData?.totals.revenue > 0
    ? ((cogsData.totals.gross_profit / cogsData.totals.revenue) * 100).toFixed(2)
    : '0.00';

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">COGS Analysis</h1>
          <p className="text-muted-foreground">Cost of goods sold tracking and analysis</p>
        </div>
        <ReturnToPOSButton />
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              Total Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(cogsData?.totals.revenue || 0)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              Total COGS
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(cogsData?.totals.cogs || 0)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              Gross Profit
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(cogsData?.totals.gross_profit || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Margin: {overallMargin}%</p>
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

      {/* Products Table */}
      <Card>
        <CardHeader>
          <CardTitle>Product COGS Breakdown</CardTitle>
          <CardDescription>
            Cost of goods sold calculated using product cost prices
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">Loading...</p>
          ) : cogsData?.products.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No sales data found. Start making sales to see COGS analysis.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Qty Sold</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">COGS</TableHead>
                  <TableHead className="text-right">Gross Profit</TableHead>
                  <TableHead className="text-right">Margin %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cogsData?.products.map((item: any) => (
                  <TableRow key={item.product_id}>
                    <TableCell className="font-medium">{item.product_name}</TableCell>
                    <TableCell>{item.category}</TableCell>
                    <TableCell className="text-right">{item.quantity_sold}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.revenue)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.cogs)}</TableCell>
                    <TableCell className={`text-right font-semibold ${item.gross_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(item.gross_profit)}
                    </TableCell>
                    <TableCell className={`text-right font-semibold ${item.margin_percent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {item.margin_percent.toFixed(1)}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
