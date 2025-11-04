import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import { Badge } from '@/components/ui/badge';
import { Search, Grid, List } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { ReturnToPOSButton } from '@/components/layout/ReturnToPOSButton';

export default function StockAndPrice() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  // Fetch products with category and store info
  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ['products-stock-price'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*, categories(name), stores(name)')
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
    return matchesSearch && matchesCategory;
  });

  const calculateMargin = (price: number, cost?: number) => {
    if (!cost || cost === 0) return null;
    return ((price - cost) / price * 100).toFixed(1);
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {productsLoading ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8">
                    Loading products...
                  </TableCell>
                </TableRow>
              ) : filteredProducts?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8">
                    No products found
                  </TableCell>
                </TableRow>
              ) : (
                filteredProducts?.map((product) => (
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
                        return (
                          <Badge 
                            variant={
                              isNegative
                                ? 'destructive'
                                : stock === 0 
                                ? 'destructive' 
                                : stock < 10 
                                ? 'secondary' 
                                : 'default'
                            }
                            className={isNegative ? 'bg-red-600 text-white hover:bg-red-700' : ''}
                          >
                            {isNegative ? '-' : ''}{Math.abs(stock)}
                          </Badge>
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
                  </TableRow>
                ))
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
                      return (
                        <Badge 
                          variant={
                            isNegative
                              ? 'destructive'
                              : stock === 0 
                              ? 'destructive' 
                              : stock < 10 
                              ? 'secondary' 
                              : 'default'
                          }
                          className={isNegative ? 'bg-red-600 text-white hover:bg-red-700' : ''}
                        >
                          {isNegative ? '-' : ''}{Math.abs(stock)}
                        </Badge>
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
    </div>
  );
}
