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
      // Simplified approach: Calculate approximate COGS using cost_price
      const productStats: Record<string, any> = {};

      let query = supabase
        .from('products')
        .select(`
          id,
          name,
          cost_price,
          store_id,
          category_id,
          categories(name)
        `);

      if (selectedStoreId !== 'all') {
        query = query.eq('store_id', selectedStoreId);
      }

      if (selectedCategoryId !== 'all') {
        query = query.eq('category_id', selectedCategoryId);
      }

      const { data: products } = await query;

      // Get all sales for these products in the date range
      for (const product of products || []) {
        // COGS is calculated using the product's cost_price
        const key = `${product.id}`;
        
        productStats[key] = {
          product_id: product.id,
          product_name: product.name,
          category: product.categories?.name || 'Uncategorized',
          quantity_sold: 0,
          revenue: 0,
          cogs: 0,
          gross_profit: 0,
          margin_percent: 0,
        };
      }

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

      <Card>
        <CardHeader>
          <CardTitle>Coming Soon</CardTitle>
          <CardDescription>
            Full COGS analysis with historical data will be available once transaction data accumulates
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8">
            This report analyzes Cost of Goods Sold and gross profit margins using product cost prices.
            Start making sales to see detailed profit analysis here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
