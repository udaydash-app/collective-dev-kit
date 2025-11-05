import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, Clock, Package } from 'lucide-react';
import { ReturnToPOSButton } from '@/components/layout/ReturnToPOSButton';
import { formatCurrency } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export default function StockAging() {
  const [selectedStoreId, setSelectedStoreId] = useState<string>('all');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [agingFilter, setAgingFilter] = useState<string>('all');

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

  const { data: agingData, isLoading } = useQuery({
    queryKey: ['stock-aging', selectedStoreId, selectedCategoryId],
    queryFn: async () => {
      let query = supabase
        .from('products')
        .select(`
          id,
          name,
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

      const results: any[] = [];
      const now = new Date();

      for (const product of products || []) {
        const { data: layers } = await supabase
          .from('inventory_layers')
          .select('*')
          .eq('product_id', product.id)
          .gt('quantity_remaining', 0)
          .order('purchased_at', { ascending: true });

        for (const layer of layers || []) {
          const purchaseDate = new Date(layer.purchased_at);
          const ageInDays = Math.floor((now.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24));
          
          let agingCategory = '0-30 days';
          let riskLevel = 'low';
          
          if (ageInDays > 180) {
            agingCategory = '180+ days';
            riskLevel = 'critical';
          } else if (ageInDays > 90) {
            agingCategory = '90-180 days';
            riskLevel = 'high';
          } else if (ageInDays > 60) {
            agingCategory = '60-90 days';
            riskLevel = 'medium';
          } else if (ageInDays > 30) {
            agingCategory = '30-60 days';
            riskLevel = 'low';
          }

          const value = Number(layer.quantity_remaining) * Number(layer.unit_cost);

          results.push({
            product_name: product.name,
            category: product.categories?.name || 'Uncategorized',
            quantity: Number(layer.quantity_remaining),
            unit_cost: Number(layer.unit_cost),
            total_value: value,
            purchase_date: layer.purchased_at,
            age_days: ageInDays,
            aging_category: agingCategory,
            risk_level: riskLevel,
          });
        }
      }

      // Filter by aging if selected
      const filtered = agingFilter !== 'all' 
        ? results.filter(r => r.aging_category === agingFilter)
        : results;

      // Sort by age descending (oldest first)
      filtered.sort((a, b) => b.age_days - a.age_days);

      // Calculate summary stats
      const summary = {
        total_value: filtered.reduce((sum, r) => sum + r.total_value, 0),
        total_items: filtered.length,
        critical_items: filtered.filter(r => r.risk_level === 'critical').length,
        high_risk_items: filtered.filter(r => r.risk_level === 'high').length,
        medium_risk_items: filtered.filter(r => r.risk_level === 'medium').length,
      };

      return { items: filtered, summary };
    },
  });

  const getRiskBadge = (riskLevel: string) => {
    switch (riskLevel) {
      case 'critical':
        return <Badge variant="destructive">Critical</Badge>;
      case 'high':
        return <Badge className="bg-orange-500">High</Badge>;
      case 'medium':
        return <Badge className="bg-yellow-500">Medium</Badge>;
      default:
        return <Badge variant="secondary">Low</Badge>;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Stock Aging Report</h1>
          <p className="text-muted-foreground">Identify slow-moving inventory and potential obsolescence</p>
        </div>
        <ReturnToPOSButton />
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              Total Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(agingData?.summary.total_value || 0)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              Critical Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{agingData?.summary.critical_items || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">180+ days old</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-orange-500" />
              High Risk Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">{agingData?.summary.high_risk_items || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">90-180 days old</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-500" />
              Medium Risk Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{agingData?.summary.medium_risk_items || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">60-90 days old</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

            <Select value={agingFilter} onValueChange={setAgingFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Ages" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Ages</SelectItem>
                <SelectItem value="0-30 days">0-30 days</SelectItem>
                <SelectItem value="30-60 days">30-60 days</SelectItem>
                <SelectItem value="60-90 days">60-90 days</SelectItem>
                <SelectItem value="90-180 days">90-180 days</SelectItem>
                <SelectItem value="180+ days">180+ days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Results Table */}
      <Card>
        <CardHeader>
          <CardTitle>Aging Details ({agingData?.items.length || 0} layers)</CardTitle>
          <CardDescription>Inventory layers sorted by age (oldest first)</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">Loading aging data...</p>
          ) : !agingData || agingData.items.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No inventory found</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Unit Cost</TableHead>
                    <TableHead className="text-right">Total Value</TableHead>
                    <TableHead>Purchase Date</TableHead>
                    <TableHead className="text-right">Age (Days)</TableHead>
                    <TableHead>Aging Category</TableHead>
                    <TableHead>Risk Level</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agingData.items.map((item: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{item.product_name}</TableCell>
                      <TableCell>{item.category}</TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.unit_cost)}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(item.total_value)}
                      </TableCell>
                      <TableCell>{new Date(item.purchase_date).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">{item.age_days}</TableCell>
                      <TableCell>{item.aging_category}</TableCell>
                      <TableCell>{getRiskBadge(item.risk_level)}</TableCell>
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
