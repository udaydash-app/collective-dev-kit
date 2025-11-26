import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Search, Grid, List, Pencil } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { ReturnToPOSButton } from '@/components/layout/ReturnToPOSButton';
import { toast } from 'sonner';

export default function StockAndPrice() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'zero' | 'positive' | 'negative'>('all');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  
  // Edit prices dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<{
    id: string;
    name: string;
    variantId?: string;
    variantLabel?: string;
    costPrice: number | null;
    wholesalePrice: number | null;
    vipPrice: number | null;
  } | null>(null);
  
  const queryClient = useQueryClient();

  // Fetch products with variants, category and store info
  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ['products-stock-price'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*, categories(name), stores(name), product_variants(*)')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Fetch categories
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const filteredProducts = products?.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.barcode?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || product.category_id === selectedCategory;
    
    // For products with variants, check if ANY variant matches the stock filter
    // For products without variants, check the product's stock
    let matchesStock = false;
    
    if (stockFilter === 'all') {
      matchesStock = true;
    } else if (product.product_variants && product.product_variants.length > 0) {
      // Check variants
      matchesStock = product.product_variants.some((variant: any) => {
        const stock = variant.stock_quantity ?? 0;
        return (
          (stockFilter === 'zero' && stock === 0) ||
          (stockFilter === 'positive' && stock > 0) ||
          (stockFilter === 'negative' && stock < 0)
        );
      });
    } else {
      // Check product stock
      const stock = product.stock_quantity ?? 0;
      matchesStock = 
        (stockFilter === 'zero' && stock === 0) ||
        (stockFilter === 'positive' && stock > 0) ||
        (stockFilter === 'negative' && stock < 0);
    }
    
    return matchesSearch && matchesCategory && matchesStock;
  });

  // Helper function to check if a stock value matches the filter
  const stockMatchesFilter = (stock: number) => {
    if (stockFilter === 'all') return true;
    if (stockFilter === 'zero') return stock === 0;
    if (stockFilter === 'positive') return stock > 0;
    if (stockFilter === 'negative') return stock < 0;
    return true;
  };

  const calculateMargin = (price: number, cost?: number) => {
    if (!cost || cost === 0) return null;
    return ((price - cost) / price * 100).toFixed(1);
  };

  // Mutation for updating prices
  const updatePricesMutation = useMutation({
    mutationFn: async (data: {
      productId: string;
      variantId?: string;
      costPrice: number | null;
      wholesalePrice: number | null;
      vipPrice: number | null;
    }) => {
      if (data.variantId) {
        const { error } = await supabase
          .from('product_variants')
          .update({
            cost_price: data.costPrice,
            wholesale_price: data.wholesalePrice,
            vip_price: data.vipPrice,
          })
          .eq('id', data.variantId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('products')
          .update({
            cost_price: data.costPrice,
            wholesale_price: data.wholesalePrice,
            vip_price: data.vipPrice,
          })
          .eq('id', data.productId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products-stock-price'] });
      toast.success('Prices updated successfully');
      setEditDialogOpen(false);
      setEditingItem(null);
    },
    onError: (error) => {
      toast.error('Failed to update prices: ' + error.message);
    },
  });

  const handleEditPrices = (
    productId: string,
    productName: string,
    costPrice: number | null,
    wholesalePrice: number | null,
    vipPrice: number | null,
    variantId?: string,
    variantLabel?: string
  ) => {
    setEditingItem({
      id: productId,
      name: productName,
      variantId,
      variantLabel,
      costPrice,
      wholesalePrice,
      vipPrice,
    });
    setEditDialogOpen(true);
  };

  const handleSavePrices = () => {
    if (!editingItem) return;
    updatePricesMutation.mutate({
      productId: editingItem.id,
      variantId: editingItem.variantId,
      costPrice: editingItem.costPrice,
      wholesalePrice: editingItem.wholesalePrice,
      vipPrice: editingItem.vipPrice,
    });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Stock & Price List</h1>
          <p className="text-muted-foreground">
            View all product details, stock levels, and pricing
          </p>
        </div>
        <ReturnToPOSButton inline />
      </div>

      {/* Filters and View Toggle */}
      <Card className="p-4">
        <div className="flex gap-4 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by product name or barcode..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-[200px]">
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
          <Select value={stockFilter} onValueChange={(value: 'all' | 'zero' | 'positive' | 'negative') => setStockFilter(value)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Stock Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stock</SelectItem>
              <SelectItem value="zero">Zero Stock</SelectItem>
              <SelectItem value="positive">In Stock</SelectItem>
              <SelectItem value="negative">Negative Stock</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex border rounded-lg">
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="rounded-r-none"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
              className="rounded-l-none"
            >
              <Grid className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Products Display */}
      {viewMode === 'list' ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product Name</TableHead>
                <TableHead>Barcode</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Store</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">Cost Price</TableHead>
                <TableHead className="text-right">Retail Price</TableHead>
                <TableHead className="text-right">Wholesale</TableHead>
                <TableHead className="text-right">VIP Price</TableHead>
                <TableHead className="text-right">Margin %</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {productsLoading ? (
                <TableRow>
                  <TableCell colSpan={12} className="text-center py-8">
                    Loading products...
                  </TableCell>
                </TableRow>
              ) : filteredProducts?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} className="text-center py-8">
                    No products found
                  </TableCell>
                </TableRow>
              ) : (
                filteredProducts?.flatMap((product) => {
                  // If product has variants, show each variant as a separate row
                  if (product.product_variants && product.product_variants.length > 0) {
                    // Filter variants based on stock filter
                    return product.product_variants
                      .filter((variant: any) => stockMatchesFilter(variant.stock_quantity ?? 0))
                      .map((variant: any) => (
                      <TableRow key={`${product.id}-${variant.id}`}>
                        <TableCell>
                          <div>
                            <span className="font-medium">{product.name}</span>
                            <span className="text-xs text-muted-foreground ml-2">({variant.label})</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {variant.barcode || product.barcode || '-'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {product.categories?.name || '-'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {product.stores?.name || '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          {(() => {
                            const stock = variant.stock_quantity ?? 0;
                            const isNegative = stock < 0;
                            const isPositive = stock > 0;
                            return (
                              <span 
                                className={`font-semibold ${
                                  isNegative 
                                    ? 'text-red-600' 
                                    : isPositive 
                                    ? 'text-green-600' 
                                    : 'text-muted-foreground'
                                }`}
                              >
                                {isNegative ? '-' : ''}{Math.abs(stock)}
                              </span>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="text-right">
                          {variant.cost_price ? formatCurrency(variant.cost_price) : 
                           product.cost_price ? formatCurrency(product.cost_price) : '-'}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {variant.price ? formatCurrency(variant.price) : 
                           product.price ? formatCurrency(product.price) : '-'}
                        </TableCell>
                        <TableCell className="text-right text-blue-600">
                          {variant.wholesale_price ? formatCurrency(variant.wholesale_price) : 
                           product.wholesale_price ? formatCurrency(product.wholesale_price) : '-'}
                        </TableCell>
                        <TableCell className="text-right text-purple-600">
                          {variant.vip_price ? formatCurrency(variant.vip_price) : 
                           product.vip_price ? formatCurrency(product.vip_price) : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          {(() => {
                            const price = variant.price || product.price;
                            const cost = variant.cost_price || product.cost_price;
                            return price && cost ? (
                              <Badge variant="outline">
                                {calculateMargin(price, cost)}%
                              </Badge>
                            ) : '-';
                          })()}
                        </TableCell>
                        <TableCell>
                          <Badge variant={product.is_available ? 'default' : 'secondary'}>
                            {product.is_available ? 'Available' : 'Unavailable'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditPrices(
                              product.id,
                              product.name,
                              variant.cost_price ?? product.cost_price,
                              variant.wholesale_price ?? product.wholesale_price,
                              variant.vip_price ?? product.vip_price,
                              variant.id,
                              variant.label
                            )}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ));
                  } else {
                    // Product has no variants, show product-level data
                    return (
                      <TableRow key={product.id}>
                        <TableCell>
                          <span className="font-medium">{product.name}</span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {product.barcode || '-'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {product.categories?.name || '-'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {product.stores?.name || '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          {(() => {
                            const stock = product.stock_quantity ?? 0;
                            const isNegative = stock < 0;
                            const isPositive = stock > 0;
                            return (
                              <span 
                                className={`font-semibold ${
                                  isNegative 
                                    ? 'text-red-600' 
                                    : isPositive 
                                    ? 'text-green-600' 
                                    : 'text-muted-foreground'
                                }`}
                              >
                                {isNegative ? '-' : ''}{Math.abs(stock)}
                              </span>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="text-right">
                          {product.cost_price ? formatCurrency(product.cost_price) : '-'}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {product.price ? formatCurrency(product.price) : '-'}
                        </TableCell>
                        <TableCell className="text-right text-blue-600">
                          {product.wholesale_price ? formatCurrency(product.wholesale_price) : '-'}
                        </TableCell>
                        <TableCell className="text-right text-purple-600">
                          {product.vip_price ? formatCurrency(product.vip_price) : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          {product.price && product.cost_price ? (
                            <Badge variant="outline">
                              {calculateMargin(product.price, product.cost_price)}%
                            </Badge>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={product.is_available ? 'default' : 'secondary'}>
                            {product.is_available ? 'Available' : 'Unavailable'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditPrices(
                              product.id,
                              product.name,
                              product.cost_price,
                              product.wholesale_price,
                              product.vip_price
                            )}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  }
                })
              )}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {productsLoading ? (
            <div className="col-span-full text-center py-8">Loading products...</div>
          ) : filteredProducts?.length === 0 ? (
            <div className="col-span-full text-center py-8">No products found</div>
          ) : (
            filteredProducts?.map((product) => (
              <Card key={product.id}>
                <CardHeader>
                  <CardTitle className="text-lg">{product.name}</CardTitle>
                  <CardDescription>
                    {product.categories?.name || 'Uncategorized'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Barcode:</span>
                    <span className="font-medium">{product.barcode || '-'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Stock:</span>
                    {(() => {
                      const stock = product.stock_quantity ?? 0;
                      const isNegative = stock < 0;
                      const isPositive = stock > 0;
                      return (
                        <span 
                          className={`font-semibold ${
                            isNegative 
                              ? 'text-red-600' 
                              : isPositive 
                              ? 'text-green-600' 
                              : 'text-muted-foreground'
                          }`}
                        >
                          {isNegative ? '-' : ''}{Math.abs(stock)}
                        </span>
                      );
                    })()}
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Cost:</span>
                    <span>{product.cost_price ? formatCurrency(product.cost_price) : '-'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Retail:</span>
                    <span className="font-semibold">
                      {product.price ? formatCurrency(product.price) : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Wholesale:</span>
                    <span className="text-blue-600">
                      {product.wholesale_price ? formatCurrency(product.wholesale_price) : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">VIP:</span>
                    <span className="text-purple-600">
                      {product.vip_price ? formatCurrency(product.vip_price) : '-'}
                    </span>
                  </div>
                  {product.price && product.cost_price && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Margin:</span>
                      <Badge variant="outline">
                        {calculateMargin(product.price, product.cost_price)}%
                      </Badge>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Status:</span>
                    <Badge variant={product.is_available ? 'default' : 'secondary'}>
                      {product.is_available ? 'Available' : 'Unavailable'}
                    </Badge>
                  </div>
                  {product.stores?.name && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Store:</span>
                      <span className="text-xs">{product.stores.name}</span>
                    </div>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-2"
                    onClick={() => handleEditPrices(
                      product.id,
                      product.name,
                      product.cost_price,
                      product.wholesale_price,
                      product.vip_price
                    )}
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit Prices
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {filteredProducts && filteredProducts.length > 0 && (
        <div className="text-center text-sm text-muted-foreground">
          Showing {filteredProducts.length} of {products?.length || 0} products
        </div>
      )}

      {/* Edit Prices Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Edit Prices - {editingItem?.name}
              {editingItem?.variantLabel && (
                <span className="text-muted-foreground text-sm ml-2">
                  ({editingItem.variantLabel})
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="costPrice">Cost Price</Label>
              <Input
                id="costPrice"
                type="number"
                step="0.01"
                value={editingItem?.costPrice ?? ''}
                onChange={(e) => setEditingItem(prev => 
                  prev ? { ...prev, costPrice: e.target.value ? parseFloat(e.target.value) : null } : null
                )}
                placeholder="Enter cost price"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wholesalePrice">Wholesale Price</Label>
              <Input
                id="wholesalePrice"
                type="number"
                step="0.01"
                value={editingItem?.wholesalePrice ?? ''}
                onChange={(e) => setEditingItem(prev => 
                  prev ? { ...prev, wholesalePrice: e.target.value ? parseFloat(e.target.value) : null } : null
                )}
                placeholder="Enter wholesale price"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vipPrice">VIP Price</Label>
              <Input
                id="vipPrice"
                type="number"
                step="0.01"
                value={editingItem?.vipPrice ?? ''}
                onChange={(e) => setEditingItem(prev => 
                  prev ? { ...prev, vipPrice: e.target.value ? parseFloat(e.target.value) : null } : null
                )}
                placeholder="Enter VIP price"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSavePrices} disabled={updatePricesMutation.isPending}>
              {updatePricesMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
