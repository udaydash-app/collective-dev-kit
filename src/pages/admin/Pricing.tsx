import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, DollarSign, Users, Package, Edit, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';
import { ReturnToPOSButton } from '@/components/layout/ReturnToPOSButton';
import { Checkbox } from '@/components/ui/checkbox';

interface Product {
  id: string;
  name: string;
  price: number;
  cost_price?: number;
  wholesale_price?: number;
  vip_price?: number;
  image_url?: string;
  category_id?: string;
  categories?: {
    name: string;
  };
}

export default function Pricing() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkPrices, setBulkPrices] = useState({
    retail: '',
    wholesale: '',
    vip: '',
  });
  const [editPrices, setEditPrices] = useState({
    retail: '',
    wholesale: '',
    vip: '',
    cost: '',
  });

  // Fetch products with categories
  const { data: products, isLoading } = useQuery({
    queryKey: ['products-pricing'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*, categories(name)')
        .order('name');
      if (error) throw error;
      return data as Product[];
    },
  });

  // Fetch categories for filter
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

  // Fetch customers by tier
  const { data: customerStats } = useQuery({
    queryKey: ['customer-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('price_tier')
        .eq('is_customer', true);
      
      if (error) throw error;
      
      const stats = {
        retail: data?.filter(c => c.price_tier === 'retail' || !c.price_tier).length || 0,
        wholesale: data?.filter(c => c.price_tier === 'wholesale').length || 0,
        vip: data?.filter(c => c.price_tier === 'vip').length || 0,
      };
      
      return stats;
    },
  });

  // Update product prices
  const updatePricesMutation = useMutation({
    mutationFn: async ({ id, prices }: { id: string; prices: any }) => {
      const { error } = await supabase
        .from('products')
        .update({
          price: prices.retail ? parseFloat(prices.retail) : null,
          wholesale_price: prices.wholesale ? parseFloat(prices.wholesale) : null,
          vip_price: prices.vip ? parseFloat(prices.vip) : null,
          cost_price: prices.cost ? parseFloat(prices.cost) : null,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products-pricing'] });
      toast.success('Prices updated successfully');
      setEditingProduct(null);
    },
    onError: (error) => {
      toast.error('Failed to update prices: ' + error.message);
    },
  });

  // Bulk update prices
  const bulkUpdateMutation = useMutation({
    mutationFn: async (prices: any) => {
      const updates = selectedProducts.map(id => ({
        id,
        price: prices.retail ? parseFloat(prices.retail) : undefined,
        wholesale_price: prices.wholesale ? parseFloat(prices.wholesale) : undefined,
        vip_price: prices.vip ? parseFloat(prices.vip) : undefined,
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from('products')
          .update(update)
          .eq('id', update.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products-pricing'] });
      toast.success(`Updated prices for ${selectedProducts.length} products`);
      setBulkEditOpen(false);
      setSelectedProducts([]);
      setBulkPrices({ retail: '', wholesale: '', vip: '' });
    },
    onError: (error) => {
      toast.error('Failed to bulk update: ' + error.message);
    },
  });

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setEditPrices({
      retail: product.price?.toString() || '',
      wholesale: product.wholesale_price?.toString() || '',
      vip: product.vip_price?.toString() || '',
      cost: product.cost_price?.toString() || '',
    });
  };

  const handleSave = () => {
    if (!editingProduct) return;
    updatePricesMutation.mutate({
      id: editingProduct.id,
      prices: editPrices,
    });
  };

  const handleBulkUpdate = () => {
    if (selectedProducts.length === 0) {
      toast.error('No products selected');
      return;
    }
    bulkUpdateMutation.mutate(bulkPrices);
  };

  const toggleProductSelection = (productId: string) => {
    setSelectedProducts(prev =>
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedProducts.length === filteredProducts?.length) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(filteredProducts?.map(p => p.id) || []);
    }
  };

  const filteredProducts = products?.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
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
          <h1 className="text-3xl font-bold">Pricing Management</h1>
          <p className="text-muted-foreground">
            Manage product prices for different customer tiers
          </p>
        </div>
        <div className="flex gap-2">
          <ReturnToPOSButton inline />
          {selectedProducts.length > 0 && (
            <Button onClick={() => setBulkEditOpen(true)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit {selectedProducts.length} Selected
            </Button>
          )}
        </div>
      </div>

      {/* Customer Tier Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Retail Customers</CardTitle>
            <Users className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{customerStats?.retail || 0}</div>
            <p className="text-xs text-muted-foreground">Standard pricing tier</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Wholesale Customers</CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{customerStats?.wholesale || 0}</div>
            <p className="text-xs text-muted-foreground">Discounted pricing tier</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">VIP Customers</CardTitle>
            <Users className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{customerStats?.vip || 0}</div>
            <p className="text-xs text-muted-foreground">Special pricing tier</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products..."
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
        </div>
      </Card>

      {/* Products Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedProducts.length === filteredProducts?.length && filteredProducts?.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Cost</TableHead>
              <TableHead className="text-right">Retail Price</TableHead>
              <TableHead className="text-right">Wholesale Price</TableHead>
              <TableHead className="text-right">VIP Price</TableHead>
              <TableHead className="text-right">Margin</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8">
                  Loading products...
                </TableCell>
              </TableRow>
            ) : filteredProducts?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8">
                  No products found
                </TableCell>
              </TableRow>
            ) : (
              filteredProducts?.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedProducts.includes(product.id)}
                      onCheckedChange={() => toggleProductSelection(product.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="h-10 w-10 rounded object-cover"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                          <Package className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <span className="font-medium">{product.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {product.categories?.name || '-'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    {product.cost_price ? formatCurrency(product.cost_price) : '-'}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {product.price ? formatCurrency(product.price) : '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    {product.wholesale_price ? (
                      <span className="text-blue-600">
                        {formatCurrency(product.wholesale_price)}
                      </span>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {product.vip_price ? (
                      <span className="text-purple-600">
                        {formatCurrency(product.vip_price)}
                      </span>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {product.price && product.cost_price ? (
                      <Badge variant="outline">
                        {calculateMargin(product.price, product.cost_price)}%
                      </Badge>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(product)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Edit Product Dialog */}
      <Dialog open={!!editingProduct} onOpenChange={() => setEditingProduct(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Prices - {editingProduct?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="cost">Cost Price</Label>
              <Input
                id="cost"
                type="number"
                step="0.01"
                value={editPrices.cost}
                onChange={(e) => setEditPrices({ ...editPrices, cost: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label htmlFor="retail">Retail Price (Standard)</Label>
              <Input
                id="retail"
                type="number"
                step="0.01"
                value={editPrices.retail}
                onChange={(e) => setEditPrices({ ...editPrices, retail: e.target.value })}
                placeholder="0.00"
              />
              {editPrices.retail && editPrices.cost && (
                <p className="text-xs text-muted-foreground mt-1">
                  Margin: {calculateMargin(parseFloat(editPrices.retail), parseFloat(editPrices.cost))}%
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="wholesale">Wholesale Price (Discounted)</Label>
              <Input
                id="wholesale"
                type="number"
                step="0.01"
                value={editPrices.wholesale}
                onChange={(e) => setEditPrices({ ...editPrices, wholesale: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label htmlFor="vip">VIP Price (Special)</Label>
              <Input
                id="vip"
                type="number"
                step="0.01"
                value={editPrices.vip}
                onChange={(e) => setEditPrices({ ...editPrices, vip: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditingProduct(null)}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button onClick={handleSave}>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Edit Dialog */}
      <Dialog open={bulkEditOpen} onOpenChange={setBulkEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Bulk Edit Prices ({selectedProducts.length} products)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Leave fields empty to keep existing prices unchanged
            </p>
            <div>
              <Label htmlFor="bulk-retail">Retail Price</Label>
              <Input
                id="bulk-retail"
                type="number"
                step="0.01"
                value={bulkPrices.retail}
                onChange={(e) => setBulkPrices({ ...bulkPrices, retail: e.target.value })}
                placeholder="Leave empty to skip"
              />
            </div>
            <div>
              <Label htmlFor="bulk-wholesale">Wholesale Price</Label>
              <Input
                id="bulk-wholesale"
                type="number"
                step="0.01"
                value={bulkPrices.wholesale}
                onChange={(e) => setBulkPrices({ ...bulkPrices, wholesale: e.target.value })}
                placeholder="Leave empty to skip"
              />
            </div>
            <div>
              <Label htmlFor="bulk-vip">VIP Price</Label>
              <Input
                id="bulk-vip"
                type="number"
                step="0.01"
                value={bulkPrices.vip}
                onChange={(e) => setBulkPrices({ ...bulkPrices, vip: e.target.value })}
                placeholder="Leave empty to skip"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setBulkEditOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleBulkUpdate}>
                Update {selectedProducts.length} Products
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
