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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Search, Package, Edit, Save, UserCircle, FileText, Receipt, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency, formatDate } from '@/lib/utils';
import { ReturnToPOSButton } from '@/components/layout/ReturnToPOSButton';

interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  discount_percentage?: number;
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
  const [selectAll, setSelectAll] = useState(false);
  const [discountPercentage, setDiscountPercentage] = useState<string>('');
  const [customerDiscountPercentage, setCustomerDiscountPercentage] = useState<string>('');
  const [showImportBillsDialog, setShowImportBillsDialog] = useState(false);
  const [selectedBill, setSelectedBill] = useState<string | null>(null);
  const [showImportConfirmDialog, setShowImportConfirmDialog] = useState(false);
  const [importPricesData, setImportPricesData] = useState<Array<{ product_id: string; product_name: string; price: number }>>([]);
  const [selectedImportProducts, setSelectedImportProducts] = useState<Set<string>>(new Set());
  const [selectAllImport, setSelectAllImport] = useState(true);
  const [priceToDelete, setPriceToDelete] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

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
        .select('id, name, email, phone, discount_percentage')
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
        .select('*, products(name, price, categories(name))')
        .eq('customer_id', selectedCustomer);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCustomer,
  });

  // Fetch all customers with custom prices
  const { data: customersWithPrices } = useQuery({
    queryKey: ['customers-with-prices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_product_prices')
        .select('customer_id, contacts(name, email, phone)')
        .order('customer_id');
      
      if (error) throw error;
      
      // Group by customer and count products
      const customerMap = new Map();
      data?.forEach((item: any) => {
        if (!customerMap.has(item.customer_id)) {
          customerMap.set(item.customer_id, {
            id: item.customer_id,
            name: item.contacts?.name,
            email: item.contacts?.email,
            phone: item.contacts?.phone,
            productCount: 0
          });
        }
        customerMap.get(item.customer_id).productCount++;
      });
      
      return Array.from(customerMap.values());
    },
  });

  // Fetch customer bills/transactions
  const { data: customerBills } = useQuery({
    queryKey: ['customer-bills', selectedCustomer],
    queryFn: async () => {
      if (!selectedCustomer) return [];
      const { data, error } = await supabase
        .from('pos_transactions')
        .select('*')
        .eq('customer_id', selectedCustomer)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCustomer && showImportBillsDialog,
  });

  // Update customer discount percentage
  const updateCustomerDiscountMutation = useMutation({
    mutationFn: async (discount: number) => {
      if (!selectedCustomer) return;
      
      const { error } = await supabase
        .from('contacts')
        .update({ discount_percentage: discount })
        .eq('id', selectedCustomer);
        
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Cart discount updated');
    },
    onError: (error: any) => {
      toast.error('Failed to update discount: ' + error.message);
    },
  });

  // Update customer product prices
  const updateCustomerPricesMutation = useMutation({
    mutationFn: async (prices: Array<{ product_id: string; price: number }>) => {
      if (!selectedCustomer) return;
      
      // Upsert prices (update existing, insert new, keep others unchanged)
      const upserts = prices.map(p => ({
        customer_id: selectedCustomer,
        product_id: p.product_id,
        price: p.price,
      }));

      const { error } = await supabase
        .from('customer_product_prices')
        .upsert(upserts, {
          onConflict: 'customer_id,product_id'
        });
        
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-product-prices'] });
      queryClient.invalidateQueries({ queryKey: ['customers-with-prices'] });
      toast.success('Customer prices updated');
      setShowAssignProductsDialog(false);
      setCustomerProductPrices({});
      setSelectAll(false);
      setDiscountPercentage('');
    },
    onError: (error: any) => {
      toast.error('Failed to update prices: ' + error.message);
    },
  });

  // Delete customer product price
  const deleteCustomerPriceMutation = useMutation({
    mutationFn: async (priceId: string) => {
      const { error } = await supabase
        .from('customer_product_prices')
        .delete()
        .eq('id', priceId);
        
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-product-prices'] });
      queryClient.invalidateQueries({ queryKey: ['customers-with-prices'] });
      toast.success('Custom price removed');
      setShowDeleteDialog(false);
      setPriceToDelete(null);
    },
    onError: (error: any) => {
      toast.error('Failed to delete price: ' + error.message);
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

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    if (!checked) {
      setCustomerProductPrices({});
    }
  };

  const handleApplyDiscount = async () => {
    if (!discountPercentage || parseFloat(discountPercentage) === 0) {
      toast.error('Enter a discount percentage');
      return;
    }

    const discount = parseFloat(discountPercentage);
    const prices: Array<{ product_id: string; price: number }> = [];

    filteredProducts?.forEach(product => {
      if (product.price) {
        const discountedPrice = product.price * (1 - discount / 100);
        prices.push({
          product_id: product.id,
          price: parseFloat(discountedPrice.toFixed(2))
        });
      }
    });

    if (prices.length === 0) {
      toast.error('No products to apply discount to');
      return;
    }

    // Save directly to database
    updateCustomerPricesMutation.mutate(prices);
    toast.success(`Applied ${discount}% discount to ${prices.length} products`);
  };

  const handleSaveCartDiscount = () => {
    if (!customerDiscountPercentage) {
      toast.error('Enter a discount percentage');
      return;
    }
    updateCustomerDiscountMutation.mutate(parseFloat(customerDiscountPercentage));
  };

  // Update customer discount when customer changes
  const handleCustomerChange = (customerId: string) => {
    setSelectedCustomer(customerId);
    const customer = customers?.find(c => c.id === customerId);
    setCustomerDiscountPercentage(customer?.discount_percentage?.toString() || '0');
  };

  const handleImportFromBill = async () => {
    if (!selectedBill || !selectedCustomer) return;

    const bill = customerBills?.find(b => b.id === selectedBill);
    if (!bill || !bill.items) {
      toast.error('Invalid bill selected');
      return;
    }

    try {
      // Items are already an array, no need to parse
      const items = bill.items as any[];
      
      // Extract product IDs, filtering out special items (combos, BOGOs, cart discounts)
      const potentialIds = items
        .filter((item: any) => {
          // Skip special items
          if (item.id === 'cart-discount') return false;
          if (item.id && typeof item.id === 'string') {
            if (item.id.startsWith('combo-')) return false;
            if (item.id.startsWith('bogo-')) return false;
            if (item.id.startsWith('multi-bogo-')) return false;
          }
          return true;
        })
        .map((item: any) => {
          // Try to get product ID from productId or id field
          return item.productId || item.id;
        })
        .filter((id: any) => id && typeof id === 'string');

      if (potentialIds.length === 0) {
        toast.error('No valid products found in this bill (may only contain combo/BOGO items)');
        return;
      }

      // Validate which IDs actually exist in products table
      const { data: existingProducts, error: validateError } = await supabase
        .from('products')
        .select('id')
        .in('id', potentialIds);

      if (validateError) {
        console.error('Validation error:', validateError);
        toast.error('Failed to validate products');
        return;
      }

      const validProductIds = new Set(existingProducts?.map(p => p.id) || []);
      
      // Create a map of product IDs to product names for display
      const productMap = new Map(existingProducts?.map(p => [p.id, p]) || []);
      const prices: Array<{ product_id: string; product_name: string; price: number }> = [];

      items.forEach((item: any) => {
        // Skip special items
        if (item.id === 'cart-discount') return;
        if (item.id && typeof item.id === 'string') {
          if (item.id.startsWith('combo-') || item.id.startsWith('bogo-') || item.id.startsWith('multi-bogo-')) return;
        }

        const productId = item.productId || item.id;
        
        // Calculate effective price: customPrice or price minus discount
        const effectivePrice = item.customPrice ?? (item.price - (item.itemDiscount || 0));
        
        // Only add if product exists and has a valid price
        if (productId && validProductIds.has(productId) && effectivePrice && effectivePrice > 0) {
          // Get product name from the item or from products data
          const productName = item.name || products?.find(p => p.id === productId)?.name || 'Unknown Product';
          prices.push({
            product_id: productId,
            product_name: productName,
            price: effectivePrice
          });
        }
      });

      if (prices.length === 0) {
        toast.error('No valid products found in this bill (products may have been deleted)');
        return;
      }

      // Store the prepared data and show confirmation dialog
      setImportPricesData(prices);
      setSelectedImportProducts(new Set(prices.map(p => p.product_id)));
      setSelectAllImport(true);
      setShowImportConfirmDialog(true);
    } catch (error: any) {
      console.error('Import bill error:', error);
      toast.error('Failed to import bill: ' + error.message);
    }
  };

  const handleConfirmImport = async () => {
    try {
      // Filter to only include selected products
      const selectedPrices = importPricesData.filter(item => 
        selectedImportProducts.has(item.product_id)
      );

      if (selectedPrices.length === 0) {
        toast.error('Please select at least one product to import');
        return;
      }

      // Remove product_name from the data before sending to mutation
      const pricesToSave = selectedPrices.map(({ product_id, price }) => ({
        product_id,
        price
      }));
      
      await updateCustomerPricesMutation.mutateAsync(pricesToSave);
      
      const skippedCount = (customerBills?.find(b => b.id === selectedBill)?.items as any[])?.length - selectedPrices.length || 0;
      let message = `Imported ${selectedPrices.length} product${selectedPrices.length === 1 ? '' : 's'} from bill`;
      if (skippedCount > 0) {
        message += ` (${skippedCount} skipped - special items or deleted products)`;
      }
      toast.success(message);
      
      setShowImportConfirmDialog(false);
      setShowImportBillsDialog(false);
      setSelectedBill(null);
      setImportPricesData([]);
    } catch (error: any) {
      console.error('Import confirmation error:', error);
      toast.error('Failed to import prices: ' + error.message);
    }
  };

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
                        <span className="font-medium">{product.name}</span>
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
            <div className="flex gap-4 flex-1 items-center">
              <Select value={selectedCustomer || ''} onValueChange={handleCustomerChange}>
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
                <>
                  <Button onClick={() => setShowAssignProductsDialog(true)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Manage Prices
                  </Button>
                  <Button variant="outline" onClick={() => setShowImportBillsDialog(true)}>
                    <Receipt className="h-4 w-4 mr-2" />
                    Import from Bills
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Products with Custom Prices */}
          {selectedCustomer && (
            <Card>
              <CardContent className="pt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Standard Price</TableHead>
                      <TableHead className="text-right">Custom Price</TableHead>
                      <TableHead className="text-right">Savings</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customerPrices && customerPrices.length > 0 ? (
                      customerPrices.map((item: any) => {
                        const standardPrice = item.products?.price || 0;
                        const customPrice = item.price;
                        const savings = standardPrice > 0 ? standardPrice - customPrice : 0;
                        const savingsPercent = standardPrice > 0 
                          ? ((savings / standardPrice) * 100).toFixed(1)
                          : '0';
                        
                        return (
                          <TableRow key={item.id}>
                            <TableCell>
                              <span className="font-medium">{item.products?.name}</span>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {item.products?.categories?.name || '-'}
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground line-through">
                              {formatCurrency(standardPrice)}
                            </TableCell>
                            <TableCell className="text-right font-bold text-primary text-lg">
                              {formatCurrency(customPrice)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge variant="default" className="bg-green-600">
                                {savingsPercent}% off
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setPriceToDelete(item.id);
                                  setShowDeleteDialog(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No custom prices set for this customer yet. Click "Manage Prices" to apply discounts.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Customers with Custom Prices */}
          {!selectedCustomer && (
            <Card>
              <CardHeader>
                <CardTitle>Customers with Custom Pricing</CardTitle>
                <CardDescription>
                  Overview of all customers who have custom prices assigned
                </CardDescription>
              </CardHeader>
              <CardContent>
                {customersWithPrices && customersWithPrices.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Customer Name</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead className="text-right">Products with Custom Prices</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customersWithPrices.map((customer: any) => (
                        <TableRow key={customer.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <UserCircle className="h-5 w-5 text-muted-foreground" />
                              {customer.name}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {customer.email || customer.phone || '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="secondary">
                              {customer.productCount} {customer.productCount === 1 ? 'product' : 'products'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                setSelectedCustomer(customer.id);
                                const customerData = customers?.find(c => c.id === customer.id);
                                setCustomerDiscountPercentage(customerData?.discount_percentage?.toString() || '0');
                              }}
                            >
                              View Details
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No customers with custom pricing yet</p>
                    <p className="text-sm mt-2">Select a customer above to assign custom prices</p>
                  </div>
                )}
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
              <div className="flex items-center gap-2 border rounded-lg px-4">
                <Checkbox
                  id="select-all"
                  checked={selectAll}
                  onCheckedChange={handleSelectAll}
                />
                <Label htmlFor="select-all" className="cursor-pointer">Select All</Label>
              </div>
            </div>

            {selectAll && (
              <Card className="p-4 bg-muted/50">
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <Label>Apply Discount to All Products (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      placeholder="e.g., 10 for 10% off"
                      value={discountPercentage}
                      onChange={(e) => setDiscountPercentage(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <Button onClick={handleApplyDiscount}>
                    Apply Discount
                  </Button>
                </div>
              </Card>
            )}
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
                        <div>
                          <p className="font-medium">{product.name}</p>
                          <p className="text-xs text-muted-foreground">{product.categories?.name}</p>
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

      {/* Import from Bills Dialog */}
      <Dialog open={showImportBillsDialog} onOpenChange={setShowImportBillsDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Import Prices from Bills - {selectedCustomerData?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {customerBills && customerBills.length > 0 ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Select a previous bill to import all product prices from that transaction
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Select</TableHead>
                      <TableHead>Bill Number</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Items</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customerBills.map((bill) => {
                      const items = bill.items ? JSON.parse(JSON.stringify(bill.items)) : [];
                      return (
                        <TableRow 
                          key={bill.id}
                          className={selectedBill === bill.id ? 'bg-muted' : ''}
                        >
                          <TableCell>
                            <Checkbox
                              checked={selectedBill === bill.id}
                              onCheckedChange={(checked) => {
                                setSelectedBill(checked ? bill.id : null);
                              }}
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              {bill.transaction_number}
                            </div>
                          </TableCell>
                          <TableCell>
                            {formatDate(bill.created_at)}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(bill.total)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="secondary">{items.length} items</Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                <div className="flex justify-end gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setShowImportBillsDialog(false);
                      setSelectedBill(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleImportFromBill}
                    disabled={!selectedBill}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Import Selected Bill
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No previous bills found for this customer</p>
                <p className="text-sm mt-2">Create a transaction first to import prices</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Import Confirmation Dialog */}
      <AlertDialog open={showImportConfirmDialog} onOpenChange={setShowImportConfirmDialog}>
        <AlertDialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <AlertDialogHeader>
            <AlertDialogTitle>Select Prices to Import</AlertDialogTitle>
            <AlertDialogDescription>
              Select which product prices you want to import for {selectedCustomerData?.name}. Selected prices will be added or updated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-6 py-2">
            <div className="flex items-center gap-2 border rounded-lg px-4 py-2 bg-muted/50">
              <Checkbox
                id="select-all-import"
                checked={selectAllImport}
                onCheckedChange={(checked) => {
                  setSelectAllImport(!!checked);
                  if (checked) {
                    setSelectedImportProducts(new Set(importPricesData.map(p => p.product_id)));
                  } else {
                    setSelectedImportProducts(new Set());
                  }
                }}
              />
              <Label htmlFor="select-all-import" className="cursor-pointer font-medium">
                Select All ({importPricesData.length} products)
              </Label>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Import</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {importPricesData.map((item) => (
                  <TableRow key={item.product_id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedImportProducts.has(item.product_id)}
                        onCheckedChange={(checked) => {
                          const newSet = new Set(selectedImportProducts);
                          if (checked) {
                            newSet.add(item.product_id);
                          } else {
                            newSet.delete(item.product_id);
                          }
                          setSelectedImportProducts(newSet);
                          setSelectAllImport(newSet.size === importPricesData.length);
                        }}
                      />
                    </TableCell>
                    <TableCell>{item.product_name}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(item.price)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowImportConfirmDialog(false);
              setImportPricesData([]);
              setSelectedImportProducts(new Set());
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmImport}
              disabled={selectedImportProducts.size === 0}
            >
              Import {selectedImportProducts.size > 0 ? `(${selectedImportProducts.size})` : ''} Selected
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Custom Price</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this custom price? The product will revert to standard pricing for this customer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowDeleteDialog(false);
              setPriceToDelete(null);
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                if (priceToDelete) {
                  deleteCustomerPriceMutation.mutate(priceToDelete);
                }
              }}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
