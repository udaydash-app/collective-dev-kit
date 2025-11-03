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
import { Search, Package, Edit, Save, UserCircle } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';
import { ReturnToPOSButton } from '@/components/layout/ReturnToPOSButton';

interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
}

interface CustomerProductPrice {
  id: string;
  customer_id: string;
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
  const [editPrices, setEditPrices] = useState({
    retail: '',
    wholesale: '',
    vip: '',
    cost: '',
  });

  // Customer pricing state
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [showAssignProductsDialog, setShowAssignProductsDialog] = useState(false);
  const [customerProductPrices, setCustomerProductPrices] = useState<Record<string, string>>({});

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

  // Fetch customers
  const { data: customers, isLoading: customersLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('id, name, email, phone')
        .eq('is_customer', true)
        .order('name');
      if (error) throw error;
      return data as Customer[];
    },
  });

  // Fetch customer product prices for selected customer
  const { data: customerPrices } = useQuery({
    queryKey: ['customer-product-prices', selectedCustomer],
    queryFn: async () => {
      if (!selectedCustomer) return [];
      const { data, error } = await supabase
        .from('customer_product_prices')
        .select('*')
        .eq('customer_id', selectedCustomer);
      if (error) throw error;
      return data as CustomerProductPrice[];
    },
    enabled: !!selectedCustomer,
  });

  // Update customer product prices
  const updateCustomerPricesMutation = useMutation({
    mutationFn: async (prices: Array<{ product_id: string; price: number }>) => {
      if (!selectedCustomer) return;
      
      // Delete existing prices for this customer
      await supabase
        .from('customer_product_prices')
        .delete()
        .eq('customer_id', selectedCustomer);

      // Insert new prices
      const inserts = prices.map(p => ({
        customer_id: selectedCustomer,
        product_id: p.product_id,
        price: p.price,
      }));

      const { error } = await supabase
        .from('customer_product_prices')
        .insert(inserts);
        
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-product-prices'] });
      toast.success('Customer prices updated');
      setShowAssignProductsDialog(false);
      setCustomerProductPrices({});
    },
    onError: (error: any) => {
      toast.error('Failed to update prices: ' + error.message);
    },
  });

  // Standard pricing mutations
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

  const handleSaveCustomerPrices = () => {
    // Start with existing prices
    const existingPricesMap = new Map(
      customerPrices?.map(cp => [cp.product_id, cp.price]) || []
    );

    // Update with newly entered prices
    Object.entries(customerProductPrices).forEach(([productId, price]) => {
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

    updateCustomerPricesMutation.mutate(prices);
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

  const productsWithCustomerPrices = filteredProducts?.map(product => {
    const customerPrice = customerPrices?.find(cp => cp.product_id === product.id);
    return {
      ...product,
      customer_price: customerPrice?.price,
    };
  });

  const calculateMargin = (price: number, cost?: number) => {
    if (!cost || cost === 0) return null;
    return ((price - cost) / price * 100).toFixed(1);
  };

  const selectedCustomerData = customers?.find(c => c.id === selectedCustomer);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Pricing Management</h1>
          <p className="text-muted-foreground">
            Manage standard pricing and customer-specific pricing
          </p>
        </div>
        <ReturnToPOSButton inline />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="standard">Standard Tiers</TabsTrigger>
          <TabsTrigger value="customer">Customer Pricing</TabsTrigger>
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

        {/* Customer Pricing Tab */}
        <TabsContent value="customer" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-4 flex-1">
              <Select value={selectedCustomer || ''} onValueChange={setSelectedCustomer}>
                <SelectTrigger className="w-[300px]">
                  <SelectValue placeholder="Select a customer" />
                </SelectTrigger>
                <SelectContent className="bg-background">
                  {customers?.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      <div className="flex flex-col">
                        <span>{customer.name}</span>
                        {customer.email && (
                          <span className="text-xs text-muted-foreground">{customer.email}</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedCustomer && (
                <Button onClick={() => setShowAssignProductsDialog(true)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Manage Prices
                </Button>
              )}
            </div>
          </div>

          {/* Selected Customer Info */}
          {selectedCustomer && selectedCustomerData && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <UserCircle className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <CardTitle>{selectedCustomerData.name}</CardTitle>
                    <CardDescription>
                      {selectedCustomerData.email || selectedCustomerData.phone || 'No contact info'}
                    </CardDescription>
                  </div>
                  <Badge variant="secondary" className="ml-auto">
                    {customerPrices?.length || 0} custom prices
                  </Badge>
                </div>
              </CardHeader>
            </Card>
          )}

          {/* Products with Customer Prices */}
          {selectedCustomer && (
            <Card>
              <CardHeader>
                <CardTitle>Custom Prices for {selectedCustomerData?.name}</CardTitle>
                <CardDescription>
                  Products with customer-specific pricing
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
                    {productsWithCustomerPrices?.filter(p => p.customer_price).map((product) => {
                      const diff = product.customer_price && product.price 
                        ? ((product.customer_price - product.price) / product.price * 100).toFixed(1)
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
                            {product.customer_price ? formatCurrency(product.customer_price) : '-'}
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
                    {productsWithCustomerPrices?.filter(p => p.customer_price).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No custom prices set for this customer yet
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {!selectedCustomer && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <UserCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select a customer to manage their custom pricing</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Assign Products Dialog */}
      <Dialog open={showAssignProductsDialog} onOpenChange={setShowAssignProductsDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Assign Products - {selectedCustomerData?.name}
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
                  const existingPrice = customerPrices?.find(cp => cp.product_id === product.id);
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
                          value={customerProductPrices[product.id] || existingPrice?.price || ''}
                          onChange={(e) => setCustomerProductPrices({
                            ...customerProductPrices,
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
              <Button onClick={handleSaveCustomerPrices}>
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
