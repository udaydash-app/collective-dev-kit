import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { Search, DollarSign, Users, Package, Edit, Save, X, Plus, Trash2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';
import { ReturnToPOSButton } from '@/components/layout/ReturnToPOSButton';
import { Checkbox } from '@/components/ui/checkbox';

interface CustomPriceTier {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
  created_at: string;
}

interface CustomTierPrice {
  id: string;
  tier_id: string;
  product_id: string;
  price: number;
}

export default function Pricing() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('standard');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  // Standard pricing state
  const [editingProduct, setEditingProduct] = useState<any>(null);
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

  // Custom tiers state
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [showNewTierDialog, setShowNewTierDialog] = useState(false);
  const [showEditTierDialog, setShowEditTierDialog] = useState(false);
  const [showAssignProductsDialog, setShowAssignProductsDialog] = useState(false);
  const [newTierData, setNewTierData] = useState({ name: '', description: '' });
  const [editingTierData, setEditingTierData] = useState<CustomPriceTier | null>(null);
  const [tierProductPrices, setTierProductPrices] = useState<Record<string, string>>({});

  // Fetch products
  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ['products-pricing'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*, categories(name)')
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

  // Fetch custom price tiers
  const { data: customTiers, isLoading: tiersLoading } = useQuery({
    queryKey: ['custom-price-tiers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('custom_price_tiers')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as CustomPriceTier[];
    },
  });

  // Fetch tier prices for selected tier
  const { data: tierPrices } = useQuery({
    queryKey: ['custom-tier-prices', selectedTier],
    queryFn: async () => {
      if (!selectedTier) return [];
      const { data, error } = await supabase
        .from('custom_tier_prices')
        .select('*')
        .eq('tier_id', selectedTier);
      if (error) throw error;
      return data as CustomTierPrice[];
    },
    enabled: !!selectedTier,
  });

  // Fetch customers assigned to tiers
  const { data: tierCustomers } = useQuery({
    queryKey: ['tier-customers', selectedTier],
    queryFn: async () => {
      if (!selectedTier) return [];
      const { data, error } = await supabase
        .from('contacts')
        .select('id, name, email, phone')
        .eq('custom_price_tier_id', selectedTier)
        .eq('is_customer', true);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedTier,
  });

  // Create custom tier
  const createTierMutation = useMutation({
    mutationFn: async (data: { name: string; description: string }) => {
      const { error } = await supabase
        .from('custom_price_tiers')
        .insert([data]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-price-tiers'] });
      toast.success('Custom price tier created');
      setShowNewTierDialog(false);
      setNewTierData({ name: '', description: '' });
    },
    onError: (error: any) => {
      toast.error('Failed to create tier: ' + error.message);
    },
  });

  // Update tier prices
  const updateTierPricesMutation = useMutation({
    mutationFn: async (prices: Array<{ product_id: string; price: number }>) => {
      if (!selectedTier) return;
      
      // Delete existing prices for this tier
      await supabase
        .from('custom_tier_prices')
        .delete()
        .eq('tier_id', selectedTier);

      // Insert new prices
      const inserts = prices.map(p => ({
        tier_id: selectedTier,
        product_id: p.product_id,
        price: p.price,
      }));

      const { error } = await supabase
        .from('custom_tier_prices')
        .insert(inserts);
        
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-tier-prices'] });
      toast.success('Tier prices updated');
      setShowAssignProductsDialog(false);
      setTierProductPrices({});
    },
    onError: (error: any) => {
      toast.error('Failed to update prices: ' + error.message);
    },
  });

  // Delete tier
  const deleteTierMutation = useMutation({
    mutationFn: async (tierId: string) => {
      const { error } = await supabase
        .from('custom_price_tiers')
        .delete()
        .eq('id', tierId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-price-tiers'] });
      toast.success('Price tier deleted');
      if (selectedTier === editingTierData?.id) {
        setSelectedTier(null);
      }
    },
    onError: (error: any) => {
      toast.error('Failed to delete tier: ' + error.message);
    },
  });

  // Standard pricing mutations (keeping existing functionality)
  const updateStandardPricesMutation = useMutation({
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
      toast.success('Prices updated');
      setEditingProduct(null);
    },
    onError: (error: any) => {
      toast.error('Failed to update: ' + error.message);
    },
  });

  const handleCreateTier = () => {
    if (!newTierData.name.trim()) {
      toast.error('Tier name is required');
      return;
    }
    createTierMutation.mutate(newTierData);
  };

  const handleDeleteTier = (tier: CustomPriceTier) => {
    if (confirm(`Delete price tier "${tier.name}"? This will remove all associated prices.`)) {
      deleteTierMutation.mutate(tier.id);
    }
  };

  const handleSaveTierPrices = () => {
    // Start with existing prices
    const existingPricesMap = new Map(
      tierPrices?.map(tp => [tp.product_id, tp.price]) || []
    );

    // Update with newly entered prices
    Object.entries(tierProductPrices).forEach(([productId, price]) => {
      if (price && parseFloat(price) > 0) {
        existingPricesMap.set(productId, parseFloat(price));
      }
    });

    // Convert to array
    const prices = Array.from(existingPricesMap.entries()).map(([product_id, price]) => ({
      product_id,
      price,
    }));

    if (prices.length === 0) {
      toast.error('Add at least one product with a price');
      return;
    }

    updateTierPricesMutation.mutate(prices);
  };

  const handleEditStandardPrice = (product: any) => {
    setEditingProduct(product);
    setEditPrices({
      retail: product.price?.toString() || '',
      wholesale: product.wholesale_price?.toString() || '',
      vip: product.vip_price?.toString() || '',
      cost: product.cost_price?.toString() || '',
    });
  };

  const handleSaveStandardPrices = () => {
    if (!editingProduct) return;
    updateStandardPricesMutation.mutate({
      id: editingProduct.id,
      prices: editPrices,
    });
  };

  const filteredProducts = products?.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || product.category_id === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const productsWithTierPrices = filteredProducts?.map(product => {
    const tierPrice = tierPrices?.find(tp => tp.product_id === product.id);
    return {
      ...product,
      tier_price: tierPrice?.price,
    };
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
            Manage standard and custom pricing tiers
          </p>
        </div>
        <ReturnToPOSButton inline />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="standard">Standard Tiers</TabsTrigger>
          <TabsTrigger value="custom">Custom Price Tiers</TabsTrigger>
        </TabsList>

        {/* Standard Tiers Tab */}
        <TabsContent value="standard" className="space-y-4">
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
                  <TableHead>Product</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Retail</TableHead>
                  <TableHead className="text-right">Wholesale</TableHead>
                  <TableHead className="text-right">VIP</TableHead>
                  <TableHead className="text-right">Margin</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productsLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : filteredProducts?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      No products found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProducts?.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {product.image_url ? (
                            <img src={product.image_url} alt={product.name} className="h-10 w-10 rounded object-cover" />
                          ) : (
                            <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                              <Package className="h-5 w-5 text-muted-foreground" />
                            </div>
                          )}
                          <span className="font-medium">{product.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {product.categories?.name || '-'}
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
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => handleEditStandardPrice(product)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Custom Tiers Tab */}
        <TabsContent value="custom" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-4">
              <Select value={selectedTier || ''} onValueChange={setSelectedTier}>
                <SelectTrigger className="w-[250px]">
                  <SelectValue placeholder="Select a price tier" />
                </SelectTrigger>
                <SelectContent className="bg-background">
                  {customTiers?.map((tier) => (
                    <SelectItem key={tier.id} value={tier.id}>
                      {tier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedTier && (
                <Button onClick={() => setShowAssignProductsDialog(true)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Manage Prices
                </Button>
              )}
            </div>
            <Button onClick={() => setShowNewTierDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Price Tier
            </Button>
          </div>

          {/* Tier Management */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {customTiers?.map((tier) => (
              <Card key={tier.id} className={selectedTier === tier.id ? 'border-primary' : ''}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{tier.name}</CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteTier(tier)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  {tier.description && (
                    <CardDescription>{tier.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Products:</span>
                      <Badge variant="secondary">
                        {tierPrices?.filter(tp => tp.tier_id === tier.id).length || 0}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Customers:</span>
                      <Badge variant="secondary">
                        {tierCustomers?.length || 0}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {customTiers?.length === 0 && (
              <Card className="col-span-full">
                <CardContent className="py-8 text-center text-muted-foreground">
                  No custom price tiers created yet. Click "Create Price Tier" to get started.
                </CardContent>
              </Card>
            )}
          </div>

          {/* Products with Tier Prices */}
          {selectedTier && (
            <Card>
              <CardHeader>
                <CardTitle>Products in {customTiers?.find(t => t.id === selectedTier)?.name}</CardTitle>
                <CardDescription>
                  Products with custom prices for this tier
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Standard Price</TableHead>
                      <TableHead className="text-right">Custom Price</TableHead>
                      <TableHead className="text-right">Difference</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productsWithTierPrices?.filter(p => p.tier_price).map((product) => {
                      const diff = product.tier_price && product.price 
                        ? ((product.tier_price - product.price) / product.price * 100).toFixed(1)
                        : null;
                      return (
                        <TableRow key={product.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              {product.image_url ? (
                                <img src={product.image_url} alt={product.name} className="h-10 w-10 rounded object-cover" />
                              ) : (
                                <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                                  <Package className="h-5 w-5 text-muted-foreground" />
                                </div>
                              )}
                              <span className="font-medium">{product.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {product.categories?.name || '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            {product.price ? formatCurrency(product.price) : '-'}
                          </TableCell>
                          <TableCell className="text-right font-bold text-primary">
                            {product.tier_price ? formatCurrency(product.tier_price) : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            {diff ? (
                              <Badge variant={parseFloat(diff) < 0 ? 'destructive' : 'default'}>
                                {diff}%
                              </Badge>
                            ) : '-'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {productsWithTierPrices?.filter(p => p.tier_price).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No products assigned to this tier yet
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      {/* Create Tier Dialog */}
      <Dialog open={showNewTierDialog} onOpenChange={setShowNewTierDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Custom Price Tier</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="tier-name">Tier Name *</Label>
              <Input
                id="tier-name"
                value={newTierData.name}
                onChange={(e) => setNewTierData({ ...newTierData, name: e.target.value })}
                placeholder="e.g., Premium Partners, Schools, Hotels"
              />
            </div>
            <div>
              <Label htmlFor="tier-description">Description</Label>
              <Textarea
                id="tier-description"
                value={newTierData.description}
                onChange={(e) => setNewTierData({ ...newTierData, description: e.target.value })}
                placeholder="Optional description"
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowNewTierDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateTier}>
                Create Tier
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign Products Dialog */}
      <Dialog open={showAssignProductsDialog} onOpenChange={setShowAssignProductsDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Assign Products - {customTiers?.find(t => t.id === selectedTier)?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Standard Price</TableHead>
                  <TableHead className="text-right">Custom Price</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts?.map((product) => {
                  const existingPrice = tierPrices?.find(tp => tp.product_id === product.id);
                  return (
                    <TableRow key={product.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {product.image_url ? (
                            <img src={product.image_url} alt={product.name} className="h-10 w-10 rounded object-cover" />
                          ) : (
                            <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                              <Package className="h-5 w-5 text-muted-foreground" />
                            </div>
                          )}
                          <div>
                            <p className="font-medium">{product.name}</p>
                            <p className="text-xs text-muted-foreground">{product.categories?.name}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {product.price ? formatCurrency(product.price) : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Enter price"
                          value={tierProductPrices[product.id] || existingPrice?.price || ''}
                          onChange={(e) => setTierProductPrices({
                            ...tierProductPrices,
                            [product.id]: e.target.value,
                          })}
                          className="w-32 ml-auto"
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAssignProductsDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveTierPrices}>
                <Save className="h-4 w-4 mr-2" />
                Save Prices
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Standard Price Dialog */}
      <Dialog open={!!editingProduct} onOpenChange={() => setEditingProduct(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Prices - {editingProduct?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Cost Price</Label>
              <Input
                type="number"
                step="0.01"
                value={editPrices.cost}
                onChange={(e) => setEditPrices({ ...editPrices, cost: e.target.value })}
              />
            </div>
            <div>
              <Label>Retail Price</Label>
              <Input
                type="number"
                step="0.01"
                value={editPrices.retail}
                onChange={(e) => setEditPrices({ ...editPrices, retail: e.target.value })}
              />
            </div>
            <div>
              <Label>Wholesale Price</Label>
              <Input
                type="number"
                step="0.01"
                value={editPrices.wholesale}
                onChange={(e) => setEditPrices({ ...editPrices, wholesale: e.target.value })}
              />
            </div>
            <div>
              <Label>VIP Price</Label>
              <Input
                type="number"
                step="0.01"
                value={editPrices.vip}
                onChange={(e) => setEditPrices({ ...editPrices, vip: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditingProduct(null)}>
                Cancel
              </Button>
              <Button onClick={handleSaveStandardPrices}>
                <Save className="h-4 w-4 mr-2" />
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
