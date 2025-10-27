import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Package, Edit, Search, Filter } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function StockAdjustment() {
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [newQuantity, setNewQuantity] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');
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
    mutationFn: async ({ productId, variantId, newStock, reason }: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (variantId) {
        // Update variant stock
        const { error } = await supabase
          .from('product_variants')
          .update({ stock_quantity: newStock })
          .eq('id', variantId);

        if (error) throw error;
      } else {
        // Update product stock
        const { error } = await supabase
          .from('products')
          .update({ stock_quantity: newStock })
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
          quantity_change: newStock,
          reason: reason,
          adjusted_by: user?.id,
          store_id: selectedStoreId,
        });

      if (logError) console.error('Error logging adjustment:', logError);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-products'] });
      toast.success('Stock quantity updated successfully');
      setEditingProduct(null);
      setNewQuantity('');
      setAdjustmentReason('');
    },
    onError: (error: any) => {
      toast.error('Failed to update stock: ' + error.message);
    },
  });

  const handleSaveAdjustment = () => {
    if (!newQuantity || newQuantity === '') {
      toast.error('Please enter a quantity');
      return;
    }
    if (!adjustmentReason.trim()) {
      toast.error('Please provide a reason for the adjustment');
      return;
    }

    const qty = parseInt(newQuantity);
    if (isNaN(qty) || qty < 0) {
      toast.error('Please enter a valid quantity');
      return;
    }

    updateStockMutation.mutate({
      productId: editingProduct.id,
      variantId: editingProduct.variantId,
      newStock: qty,
      reason: adjustmentReason,
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

  const getStockStatus = (stock: number) => {
    if (stock === 0) return { label: 'Out of Stock', color: 'destructive' };
    if (stock < 10) return { label: 'Low Stock', color: 'warning' };
    return { label: 'In Stock', color: 'success' };
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

      {/* Products List */}
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
            <div className="space-y-4">
              {filteredProducts?.map((product) => {
                const hasVariants = product.product_variants && product.product_variants.length > 0;
                const baseStock = product.stock_quantity || 0;
                const baseStatus = getStockStatus(baseStock);

                return (
                  <div key={product.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold text-lg">{product.name}</h3>
                          <Badge variant={baseStatus.color as any}>{baseStatus.label}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {product.categories?.name || 'Uncategorized'}
                          {product.barcode && ` • Barcode: ${product.barcode}`}
                        </p>
                      </div>
                    </div>

                    {/* Base Product Stock */}
                    {!hasVariants && (
                      <div className="flex items-center justify-between bg-muted/50 p-3 rounded-lg">
                        <div>
                          <p className="text-sm text-muted-foreground">Current Stock</p>
                          <p className="text-2xl font-bold">{baseStock}</p>
                        </div>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingProduct({ ...product, variantId: null });
                                setNewQuantity(baseStock.toString());
                              }}
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Adjust
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Adjust Stock - {product.name}</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                              <div className="space-y-2">
                                <Label>Current Stock</Label>
                                <p className="text-2xl font-bold">{baseStock}</p>
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="newQuantity">New Quantity *</Label>
                                <Input
                                  id="newQuantity"
                                  type="number"
                                  min="0"
                                  value={newQuantity}
                                  onChange={(e) => setNewQuantity(e.target.value)}
                                  placeholder="Enter new quantity"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="reason">Reason for Adjustment *</Label>
                                <Textarea
                                  id="reason"
                                  value={adjustmentReason}
                                  onChange={(e) => setAdjustmentReason(e.target.value)}
                                  placeholder="e.g., Physical count, damaged goods, etc."
                                  rows={3}
                                />
                              </div>
                              <Button 
                                onClick={handleSaveAdjustment} 
                                className="w-full"
                                disabled={updateStockMutation.isPending}
                              >
                                {updateStockMutation.isPending ? 'Saving...' : 'Save Adjustment'}
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    )}

                    {/* Variants Stock */}
                    {hasVariants && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Variants:</p>
                        {product.product_variants.map((variant: any) => {
                          const variantStock = variant.stock_quantity || 0;
                          const variantStatus = getStockStatus(variantStock);

                          return (
                            <div key={variant.id} className="flex items-center justify-between bg-muted/50 p-3 rounded-lg">
                              <div className="flex items-center gap-3">
                                <div>
                                  <p className="font-medium">{variant.label}</p>
                                  <p className="text-sm text-muted-foreground">
                                    Stock: <span className="font-semibold">{variantStock}</span>
                                  </p>
                                </div>
                                <Badge variant={variantStatus.color as any} className="ml-2">
                                  {variantStatus.label}
                                </Badge>
                              </div>
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setEditingProduct({ 
                                        ...product, 
                                        variantId: variant.id,
                                        variantLabel: variant.label 
                                      });
                                      setNewQuantity(variantStock.toString());
                                    }}
                                  >
                                    <Edit className="h-4 w-4 mr-2" />
                                    Adjust
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>
                                      Adjust Stock - {product.name} ({variant.label})
                                    </DialogTitle>
                                  </DialogHeader>
                                  <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                      <Label>Current Stock</Label>
                                      <p className="text-2xl font-bold">{variantStock}</p>
                                    </div>
                                    <div className="space-y-2">
                                      <Label htmlFor="newQuantity">New Quantity *</Label>
                                      <Input
                                        id="newQuantity"
                                        type="number"
                                        min="0"
                                        value={newQuantity}
                                        onChange={(e) => setNewQuantity(e.target.value)}
                                        placeholder="Enter new quantity"
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label htmlFor="reason">Reason for Adjustment *</Label>
                                      <Textarea
                                        id="reason"
                                        value={adjustmentReason}
                                        onChange={(e) => setAdjustmentReason(e.target.value)}
                                        placeholder="e.g., Physical count, damaged goods, etc."
                                        rows={3}
                                      />
                                    </div>
                                    <Button 
                                      onClick={handleSaveAdjustment} 
                                      className="w-full"
                                      disabled={updateStockMutation.isPending}
                                    >
                                      {updateStockMutation.isPending ? 'Saving...' : 'Save Adjustment'}
                                    </Button>
                                  </div>
                                </DialogContent>
                              </Dialog>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
