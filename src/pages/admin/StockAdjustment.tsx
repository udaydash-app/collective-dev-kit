import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Package, Search, Filter } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function StockAdjustment() {
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [stockInputs, setStockInputs] = useState<Record<string, string>>({});
  const queryClient = useQueryClient();

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

  const { data: products, isLoading } = useQuery({
    queryKey: ['stock-products', selectedStoreId, selectedCategoryId],
    queryFn: async () => {
      if (!selectedStoreId) return [];

      let query = supabase
        .from('products')
        .select(`
          *,
          categories(name),
          product_variants(id, label, stock_quantity, is_available)
        `)
        .eq('store_id', selectedStoreId)
        .order('name');

      if (selectedCategoryId !== 'all') {
        query = query.eq('category_id', selectedCategoryId);
      }

      const { data } = await query;
      return data || [];
    },
    enabled: !!selectedStoreId,
  });

  const updateStockMutation = useMutation({
    mutationFn: async ({ productId, variantId, systemStock, currentStock }: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      const difference = currentStock - systemStock;
      
      if (variantId) {
        // Update variant stock
        const { error } = await supabase
          .from('product_variants')
          .update({ stock_quantity: currentStock })
          .eq('id', variantId);

        if (error) throw error;
      } else {
        // Update product stock
        const { error } = await supabase
          .from('products')
          .update({ stock_quantity: currentStock })
          .eq('id', productId);

        if (error) throw error;
      }

      // Log the adjustment
      const { error: logError } = await supabase
        .from('stock_adjustments')
        .insert({
          product_id: productId,
          variant_id: variantId,
          adjustment_type: 'manual',
          quantity_change: difference,
          reason: 'Physical stock count adjustment',
          adjusted_by: user?.id,
          store_id: selectedStoreId,
        });

      if (logError) console.error('Error logging adjustment:', logError);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-products'] });
      toast.success('Stock updated successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to update stock: ' + error.message);
    },
  });

  const handleStockUpdate = (key: string, systemStock: number, productId: string, variantId?: string) => {
    const inputValue = stockInputs[key];
    if (!inputValue || inputValue === '') return;

    const currentStock = parseInt(inputValue);
    if (isNaN(currentStock) || currentStock < 0) {
      toast.error('Please enter a valid quantity');
      return;
    }

    if (currentStock === systemStock) {
      // No change needed
      return;
    }

    updateStockMutation.mutate({
      productId,
      variantId,
      systemStock,
      currentStock,
    });
  };

  const filteredProducts = products?.filter((product) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      product.name.toLowerCase().includes(query) ||
      product.barcode?.toLowerCase().includes(query)
    );
  });

  const calculateDifference = (key: string, systemStock: number) => {
    const inputValue = stockInputs[key];
    if (!inputValue || inputValue === '') return null;
    const currentStock = parseInt(inputValue);
    if (isNaN(currentStock)) return null;
    return currentStock - systemStock;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Stock Adjustment</h1>
          <p className="text-muted-foreground">View and adjust inventory after physical verification</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="store">Store *</Label>
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

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="All categories" />
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

            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search by name or barcode..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Products Table */}
      {!selectedStoreId ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Please select a store to view products</p>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">Loading products...</p>
          </CardContent>
        </Card>
      ) : filteredProducts && filteredProducts.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">No products found</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Products ({filteredProducts?.length || 0})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="h-10">Product Name</TableHead>
                    <TableHead className="h-10">Barcode</TableHead>
                    <TableHead className="h-10">Variant</TableHead>
                    <TableHead className="text-right h-10">System Stock</TableHead>
                    <TableHead className="text-right h-10">Current Stock</TableHead>
                    <TableHead className="text-right h-10">Difference</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts?.map((product) => {
                    const hasVariants = product.product_variants && product.product_variants.length > 0;

                    if (!hasVariants) {
                      const systemStock = product.stock_quantity || 0;
                      const key = `product-${product.id}`;
                      const difference = calculateDifference(key, systemStock);

                      return (
                        <TableRow key={product.id} className="h-12">
                          <TableCell className="font-medium py-2">{product.name}</TableCell>
                          <TableCell className="py-2">{product.barcode || '-'}</TableCell>
                          <TableCell className="py-2">-</TableCell>
                          <TableCell className="text-right py-2">{systemStock}</TableCell>
                          <TableCell className="text-right py-2">
                            <Input
                              type="number"
                              min="0"
                              value={stockInputs[key] || ''}
                              onChange={(e) => setStockInputs({ ...stockInputs, [key]: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleStockUpdate(key, systemStock, product.id);
                                }
                              }}
                              onBlur={() => handleStockUpdate(key, systemStock, product.id)}
                              className="w-24 text-right border-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent h-8 px-2"
                            />
                          </TableCell>
                          <TableCell className={`text-right font-semibold py-2 ${
                            difference === null ? '' : 
                            difference > 0 ? 'text-green-600' : 
                            difference < 0 ? 'text-red-600' : 
                            'text-muted-foreground'
                          }`}>
                            {difference !== null ? (difference > 0 ? `+${difference}` : difference) : '-'}
                          </TableCell>
                        </TableRow>
                      );
                    } else {
                      return product.product_variants.map((variant: any, index: number) => {
                        const systemStock = variant.stock_quantity || 0;
                        const key = `variant-${variant.id}`;
                        const difference = calculateDifference(key, systemStock);

                        return (
                          <TableRow key={variant.id} className="h-12">
                            <TableCell className="font-medium py-2">
                              {index === 0 ? product.name : ''}
                            </TableCell>
                            <TableCell className="py-2">{index === 0 ? (product.barcode || '-') : ''}</TableCell>
                            <TableCell className="py-2">{variant.label}</TableCell>
                            <TableCell className="text-right py-2">{systemStock}</TableCell>
                            <TableCell className="text-right py-2">
                              <Input
                                type="number"
                                min="0"
                                value={stockInputs[key] || ''}
                                onChange={(e) => setStockInputs({ ...stockInputs, [key]: e.target.value })}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleStockUpdate(key, systemStock, product.id, variant.id);
                                  }
                                }}
                                onBlur={() => handleStockUpdate(key, systemStock, product.id, variant.id)}
                                className="w-24 text-right border-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent h-8 px-2"
                              />
                            </TableCell>
                            <TableCell className={`text-right font-semibold py-2 ${
                              difference === null ? '' : 
                              difference > 0 ? 'text-green-600' : 
                              difference < 0 ? 'text-red-600' : 
                              'text-muted-foreground'
                            }`}>
                              {difference !== null ? (difference > 0 ? `+${difference}` : difference) : '-'}
                            </TableCell>
                          </TableRow>
                        );
                      });
                    }
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
