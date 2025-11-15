import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Package, Search, Filter, DollarSign } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ReturnToPOSButton } from '@/components/layout/ReturnToPOSButton';
import { formatCurrency } from '@/lib/utils';

export default function StockAdjustment() {
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [stockInputs, setStockInputs] = useState<Record<string, string>>({});
  const [costInputs, setCostInputs] = useState<Record<string, string>>({});
  const [reasonInputs, setReasonInputs] = useState<Record<string, string>>({});
  const [barcodeInputs, setBarcodeInputs] = useState<Record<string, string>>({});
  const [variantInputs, setVariantInputs] = useState<Record<string, string>>({});
  const [categoryInputs, setCategoryInputs] = useState<Record<string, string>>({});
  const [suggestedCosts, setSuggestedCosts] = useState<Record<string, any>>({});
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
          product_variants(id, label, stock_quantity, is_available, barcode, cost_price)
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
    mutationFn: async ({ productId, variantId, systemStock, currentStock, unitCost, reason, key }: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      const adjustmentQuantity = currentStock - systemStock;
      
      if (adjustmentQuantity === 0) return;

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

      // Log the adjustment with FIFO tracking
      const { error: logError } = await supabase
        .from('stock_adjustments')
        .insert({
          product_id: productId,
          variant_id: variantId,
          adjustment_type: 'manual',
          adjustment_quantity: adjustmentQuantity,
          quantity_change: currentStock, // Store absolute current stock, not the delta
          unit_cost: unitCost || 0,
          cost_source: unitCost ? 'manual' : 'system',
          reason: reason || 'Physical stock count adjustment',
          adjusted_by: user?.id,
          store_id: selectedStoreId,
        });

      if (logError) throw logError;

      // Clear inputs
      setStockInputs(prev => ({ ...prev, [key]: '' }));
      setCostInputs(prev => ({ ...prev, [key]: '' }));
      setReasonInputs(prev => ({ ...prev, [key]: 'count' }));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-products'] });
      toast.success('Stock adjusted successfully with FIFO tracking');
    },
    onError: (error: any) => {
      toast.error('Failed to adjust stock: ' + error.message);
    },
  });

  const updateBarcodeMutation = useMutation({
    mutationFn: async ({ productId, variantId, newBarcode }: any) => {
      if (variantId) {
        // Update variant barcode
        const { error } = await supabase
          .from('product_variants')
          .update({ barcode: newBarcode || null })
          .eq('id', variantId);

        if (error) throw error;
      } else {
        // Update product barcode
        const { error } = await supabase
          .from('products')
          .update({ barcode: newBarcode || null })
          .eq('id', productId);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-products'] });
      toast.success('Barcode updated successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to update barcode: ' + error.message);
    },
  });

  const updateVariantMutation = useMutation({
    mutationFn: async ({ variantId, newLabel }: any) => {
      const { error } = await supabase
        .from('product_variants')
        .update({ label: newLabel })
        .eq('id', variantId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-products'] });
      toast.success('Variant label updated successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to update variant: ' + error.message);
    },
  });

  const createVariantMutation = useMutation({
    mutationFn: async ({ productId, label, price }: any) => {
      const { error } = await supabase
        .from('product_variants')
        .insert({
          product_id: productId,
          label: label,
          price: price,
          unit: 'pcs',
          is_default: true,
          is_available: true,
          stock_quantity: 0,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-products'] });
      toast.success('Variant created successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to create variant: ' + error.message);
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async ({ productId, categoryId }: any) => {
      const { error } = await supabase
        .from('products')
        .update({ category_id: categoryId || null })
        .eq('id', productId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-products'] });
      toast.success('Category updated successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to update category: ' + error.message);
    },
  });

  const fetchSuggestedCost = async (productId: string, variantId?: string) => {
    const key = variantId ? `variant-${variantId}` : `product-${productId}`;
    
    try {
      const { data, error } = await supabase
        .rpc('get_suggested_adjustment_cost', {
          p_product_id: productId,
          p_variant_id: variantId || null,
        });

      if (error) throw error;
      
      if (data && data.length > 0) {
        setSuggestedCosts(prev => ({ ...prev, [key]: data[0] }));
      }
    } catch (error) {
      console.error('Error fetching suggested cost:', error);
    }
  };

  const handleStockUpdate = (key: string, systemStock: number, productId: string, variantId?: string) => {
    const inputValue = stockInputs[key];
    if (!inputValue || inputValue === '') return;

    const currentStock = parseInt(inputValue);
    if (isNaN(currentStock) || currentStock < 0) {
      toast.error('Please enter a valid quantity');
      return;
    }

    if (currentStock === systemStock) {
      return;
    }

    const difference = currentStock - systemStock;
    const unitCost = parseFloat(costInputs[key] || '0');
    const reason = reasonInputs[key] || 'count';

    // For stock increases, require cost input
    if (difference > 0 && (!costInputs[key] || unitCost <= 0)) {
      toast.error('Please enter unit cost for stock increases');
      return;
    }

    updateStockMutation.mutate({
      productId,
      variantId,
      systemStock,
      currentStock,
      unitCost,
      reason,
      key,
    });
  };

  const handleBarcodeUpdate = (key: string, originalBarcode: string, productId: string, variantId?: string) => {
    const inputValue = barcodeInputs[key];
    if (inputValue === undefined) return; // Not edited
    
    const newBarcode = inputValue.trim();
    if (newBarcode === originalBarcode) {
      // No change
      return;
    }

    updateBarcodeMutation.mutate({
      productId,
      variantId,
      newBarcode,
    });
  };

  const handleVariantUpdate = (key: string, originalLabel: string, variantId: string) => {
    const inputValue = variantInputs[key];
    if (inputValue === undefined) return; // Not edited
    
    const newLabel = inputValue.trim();
    if (!newLabel) {
      toast.error('Variant label cannot be empty');
      return;
    }
    
    if (newLabel === originalLabel) {
      // No change
      return;
    }

    updateVariantMutation.mutate({
      variantId,
      newLabel,
    });
  };

  const handleVariantCreate = (key: string, productId: string, productPrice: number) => {
    const inputValue = variantInputs[key];
    if (inputValue === undefined || inputValue.trim() === '') return; // Not edited or empty
    
    const label = inputValue.trim();
    if (!label) {
      return;
    }

    createVariantMutation.mutate({
      productId,
      label,
      price: productPrice,
    });
  };

  const handleCategoryUpdate = (productId: string, originalCategoryId: string | null, newCategoryId: string) => {
    if (newCategoryId === originalCategoryId) {
      // No change
      return;
    }

    updateCategoryMutation.mutate({
      productId,
      categoryId: newCategoryId === 'none' ? null : newCategoryId,
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

  const handleBarcodeScanned = (barcode: string) => {
    if (!barcode.trim() || !filteredProducts) return;
    
    // Find product by barcode
    const product = filteredProducts.find((p) => {
      // Check main product barcode
      if (p.barcode === barcode) return true;
      // Check variant barcodes
      if (p.product_variants?.some((v: any) => v.barcode === barcode)) return true;
      return false;
    });

    if (product) {
      // Check if it's a variant match
      const variant = product.product_variants?.find((v: any) => v.barcode === barcode);
      const key = variant ? `variant-${variant.id}` : `product-${product.id}`;
      
      // Focus on the input field
      setTimeout(() => {
        const input = document.querySelector(`input[data-key="${key}"]`) as HTMLInputElement;
        if (input) {
          input.focus();
          input.select();
        }
      }, 100);
      
      toast.success(`Found: ${product.name}${variant ? ` (${variant.label})` : ''}`);
    } else {
      toast.error('Product not found with barcode: ' + barcode);
    }
    
    setBarcodeInput('');
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Stock Adjustment</h1>
          <p className="text-muted-foreground">View and adjust inventory after physical verification</p>
        </div>
        <ReturnToPOSButton />
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="barcode">Scan Barcode</Label>
              <Input
                id="barcode"
                placeholder="Scan or enter barcode..."
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleBarcodeScanned(barcodeInput);
                  }
                }}
                autoComplete="off"
              />
            </div>

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
                  placeholder="Search by name..."
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
                    <TableHead className="h-10 text-left">Product Name</TableHead>
                    <TableHead className="h-10 text-left">Category</TableHead>
                    <TableHead className="h-10 text-left">Barcode</TableHead>
                    <TableHead className="h-10 text-left">Variant</TableHead>
                    <TableHead className="text-right h-10">System Stock</TableHead>
                    <TableHead className="text-right h-10">Current Stock</TableHead>
                    <TableHead className="text-right h-10">Difference</TableHead>
                    <TableHead className="text-right h-10">Cost Price</TableHead>
                    <TableHead className="text-right h-10">Unit Cost</TableHead>
                    <TableHead className="h-10 text-left">Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts?.map((product) => {
                    const hasVariants = product.product_variants && product.product_variants.length > 0;

                    if (!hasVariants) {
                      const systemStock = product.stock_quantity || 0;
                      const key = `product-${product.id}`;
                      const difference = calculateDifference(key, systemStock);
                      const suggested = suggestedCosts[key];

                      return (
                        <TableRow key={product.id} className="h-12">
                          <TableCell className="font-medium py-2 text-left">{product.name}</TableCell>
                          <TableCell className="py-2 text-left">
                            <Select
                              value={categoryInputs[product.id] || product.category_id || 'none'}
                              onValueChange={(value) => {
                                setCategoryInputs({ ...categoryInputs, [product.id]: value });
                                handleCategoryUpdate(product.id, product.category_id, value);
                              }}
                            >
                              <SelectTrigger className="w-40 h-8 border-0 focus:ring-0 focus:ring-offset-0 bg-transparent text-left">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">No Category</SelectItem>
                                {categories?.map((category) => (
                                  <SelectItem key={category.id} value={category.id}>
                                    {category.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="py-2">
                            <Input
                              type="text"
                              value={barcodeInputs[key] !== undefined ? barcodeInputs[key] : (product.barcode || '')}
                              onChange={(e) => setBarcodeInputs({ ...barcodeInputs, [key]: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleBarcodeUpdate(key, product.barcode || '', product.id);
                                }
                              }}
                              onBlur={() => handleBarcodeUpdate(key, product.barcode || '', product.id)}
                              className="w-32 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent h-8 px-2"
                            />
                          </TableCell>
                          <TableCell className="py-2">
                            <Input
                              type="text"
                              placeholder="Add variant"
                              value={variantInputs[key] || ''}
                              onChange={(e) => setVariantInputs({ ...variantInputs, [key]: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleVariantCreate(key, product.id, product.price || 0);
                                }
                              }}
                              onBlur={() => handleVariantCreate(key, product.id, product.price || 0)}
                              className="w-32 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent h-8 px-2"
                            />
                          </TableCell>
                          <TableCell className={`text-right py-2 font-semibold ${
                            systemStock < 0 
                              ? 'text-red-600' 
                              : systemStock > 0 
                              ? 'text-green-600' 
                              : 'text-muted-foreground'
                          }`}>
                            {systemStock < 0 ? '-' : ''}{Math.abs(systemStock)}
                          </TableCell>
                          <TableCell className="text-right py-2">
                            <Input
                              type="number"
                              min="0"
                              value={stockInputs[key] || ''}
                              data-key={key}
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
                          <TableCell className="text-right py-2 text-muted-foreground">
                            {product.cost_price ? formatCurrency(product.cost_price) : '-'}
                          </TableCell>
                          <TableCell className="text-right py-2">
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder={suggested?.weighted_avg_cost?.toFixed(2) || '0.00'}
                                value={costInputs[key] || ''}
                                onChange={(e) => setCostInputs({ ...costInputs, [key]: e.target.value })}
                                onFocus={() => !suggested && fetchSuggestedCost(product.id)}
                                className="w-24 text-right border-0 focus-visible:ring-1 bg-transparent h-8 px-2"
                                disabled={difference !== null && difference <= 0}
                              />
                              {suggested && (
                                <span title={`Last: ${suggested.last_purchase_cost?.toFixed(2) || 'N/A'} | Avg: ${suggested.weighted_avg_cost?.toFixed(2) || 'N/A'} | FIFO: ${suggested.next_fifo_cost?.toFixed(2) || 'N/A'}`}>
                                  <DollarSign className="h-3 w-3 text-muted-foreground" />
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="py-2">
                            <Select
                              value={reasonInputs[key] || 'count'}
                              onValueChange={(value) => setReasonInputs({ ...reasonInputs, [key]: value })}
                            >
                              <SelectTrigger className="w-32 h-8 border-0 focus:ring-0 focus:ring-offset-0 bg-transparent">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="count">Physical Count</SelectItem>
                                <SelectItem value="damage">Damage</SelectItem>
                                <SelectItem value="loss">Loss/Theft</SelectItem>
                                <SelectItem value="found">Found</SelectItem>
                                <SelectItem value="correction">Correction</SelectItem>
                                <SelectItem value="return">Return</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      );
                    } else {
                      return product.product_variants.map((variant: any, index: number) => {
                        const systemStock = variant.stock_quantity || 0;
                        const key = `variant-${variant.id}`;
                        const difference = calculateDifference(key, systemStock);
                        const suggested = suggestedCosts[key];

                        return (
                          <TableRow key={variant.id} className="h-12">
                            <TableCell className="font-medium py-2 text-left">
                              {index === 0 ? product.name : ''}
                            </TableCell>
                            <TableCell className="py-2 text-left">
                              {index === 0 ? (
                                <Select
                                  value={categoryInputs[product.id] || product.category_id || 'none'}
                                  onValueChange={(value) => {
                                    setCategoryInputs({ ...categoryInputs, [product.id]: value });
                                    handleCategoryUpdate(product.id, product.category_id, value);
                                  }}
                                >
                                  <SelectTrigger className="w-40 h-8 border-0 focus:ring-0 focus:ring-offset-0 bg-transparent text-left">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">No Category</SelectItem>
                                    {categories?.map((category) => (
                                      <SelectItem key={category.id} value={category.id}>
                                        {category.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : ''}
                            </TableCell>
                            <TableCell className="py-2">
                              <div className="space-y-1">
                                {index === 0 && (
                                  <Input
                                    type="text"
                                    value={barcodeInputs[`product-${product.id}`] !== undefined ? barcodeInputs[`product-${product.id}`] : (product.barcode || '')}
                                    onChange={(e) => setBarcodeInputs({ ...barcodeInputs, [`product-${product.id}`]: e.target.value })}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        handleBarcodeUpdate(`product-${product.id}`, product.barcode || '', product.id);
                                      }
                                    }}
                                    onBlur={() => handleBarcodeUpdate(`product-${product.id}`, product.barcode || '', product.id)}
                                    className="w-32 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent h-8 px-2"
                                    placeholder="Product barcode"
                                  />
                                )}
                                <Input
                                  type="text"
                                  value={barcodeInputs[key] !== undefined ? barcodeInputs[key] : (variant.barcode || '')}
                                  onChange={(e) => setBarcodeInputs({ ...barcodeInputs, [key]: e.target.value })}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      handleBarcodeUpdate(key, variant.barcode || '', product.id, variant.id);
                                    }
                                  }}
                                  onBlur={() => handleBarcodeUpdate(key, variant.barcode || '', product.id, variant.id)}
                                  className="w-32 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent h-8 px-2"
                                  placeholder="Variant barcode"
                                />
                              </div>
                            </TableCell>
                            <TableCell className="py-2">
                              <Input
                                type="text"
                                value={variantInputs[key] !== undefined ? variantInputs[key] : variant.label}
                                onChange={(e) => setVariantInputs({ ...variantInputs, [key]: e.target.value })}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleVariantUpdate(key, variant.label, variant.id);
                                  }
                                }}
                                onBlur={() => handleVariantUpdate(key, variant.label, variant.id)}
                                className="w-32 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent h-8 px-2"
                              />
                            </TableCell>
                            <TableCell className={`text-right py-2 font-semibold ${
                              systemStock < 0 
                                ? 'text-red-600' 
                                : systemStock > 0 
                                ? 'text-green-600' 
                                : 'text-muted-foreground'
                            }`}>
                              {systemStock < 0 ? '-' : ''}{Math.abs(systemStock)}
                            </TableCell>
                            <TableCell className="text-right py-2">
                              <Input
                                type="number"
                                min="0"
                                value={stockInputs[key] || ''}
                                data-key={key}
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
                            <TableCell className="text-right py-2 text-muted-foreground">
                              {variant.cost_price ? formatCurrency(variant.cost_price) : (product.cost_price ? formatCurrency(product.cost_price) : '-')}
                            </TableCell>
                            <TableCell className="text-right py-2">
                              <div className="flex items-center gap-1">
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  placeholder={suggested?.weighted_avg_cost?.toFixed(2) || '0.00'}
                                  value={costInputs[key] || ''}
                                  onChange={(e) => setCostInputs({ ...costInputs, [key]: e.target.value })}
                                  onFocus={() => !suggested && fetchSuggestedCost(product.id, variant.id)}
                                  className="w-24 text-right border-0 focus-visible:ring-1 bg-transparent h-8 px-2"
                                  disabled={difference !== null && difference <= 0}
                                />
                                {suggested && (
                                  <span title={`Last: ${suggested.last_purchase_cost?.toFixed(2) || 'N/A'} | Avg: ${suggested.weighted_avg_cost?.toFixed(2) || 'N/A'} | FIFO: ${suggested.next_fifo_cost?.toFixed(2) || 'N/A'}`}>
                                    <DollarSign className="h-3 w-3 text-muted-foreground" />
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="py-2">
                              <Select
                                value={reasonInputs[key] || 'count'}
                                onValueChange={(value) => setReasonInputs({ ...reasonInputs, [key]: value })}
                              >
                                <SelectTrigger className="w-32 h-8 border-0 focus:ring-0 focus:ring-offset-0 bg-transparent">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="count">Physical Count</SelectItem>
                                  <SelectItem value="damage">Damage</SelectItem>
                                  <SelectItem value="loss">Loss/Theft</SelectItem>
                                  <SelectItem value="found">Found</SelectItem>
                                  <SelectItem value="correction">Correction</SelectItem>
                                  <SelectItem value="return">Return</SelectItem>
                                </SelectContent>
                              </Select>
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
